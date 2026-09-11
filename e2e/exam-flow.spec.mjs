import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

// TO RUN ---------> npm run test:e2e 

const electronMain = 'dist/electron/UnPackaged/electron-main.js'

const repoRoot = path.join(import.meta.dirname, '..');
const teachMain = path.join(repoRoot, 'teacher', electronMain);
const studMain = path.join(repoRoot, 'student', electronMain);
const serverApiPort = '23422';

async function startWebsiteServer() {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><title>Next Exam E2E</title><main>Website exam ready</main>');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}/next-exam-e2e` };
}

// Returns the application renderer instead of an automatically opened DevTools page.
async function getAppWindow(electronApp) {
  await electronApp.firstWindow();
  await expect.poll(() => electronApp.windows().some((page) => page.url().startsWith('file:')), {
    timeout: 30_000
  }).toBe(true);
  return electronApp.windows().find((page) => page.url().startsWith('file:'));
}
// Places the teacher and student windows side by side on the selected monitor.
// Not really needed for the test to pass, but it makes it easier to see what is happening during the test.
async function placeWindow(electronApp, side, monitorIndex = 1) {
  await electronApp.evaluate(({ BrowserWindow, screen }, placement) => {
    const display = screen.getAllDisplays()[placement.monitorIndex] ?? screen.getPrimaryDisplay();
    const { x, y, width, height } = display.workArea;
    const halfWidth = Math.floor(width / 2);
    const window = BrowserWindow.getAllWindows()[0];

    window.setBounds({
      x: placement.side === 'left' ? x : x + halfWidth,
      y,
      width: halfWidth,
      height
    });
  }, { side, monitorIndex });
}

// Adds custom files or URLs through the teacher materials dialog.
async function addCustomResources(teacherWindow, resources) {
  for (const resource of resources) {
    const resourcePath = typeof resource === 'string' ? resource : resource.path;
    const resourceUrl = typeof resource === 'object' ? resource.url : null;

    await teacherWindow.locator('.materials-sidebar-list .sidebar-pick-btn').click();
    await expect(teacherWindow.locator('.swal2-popup')).toBeVisible();
    if (resourcePath) {
      const absolutePath = path.isAbsolute(resourcePath) ? resourcePath : path.join(repoRoot, resourcePath);
      await teacherWindow.locator('#swalFile').setInputFiles(absolutePath);
    }
    if (resourceUrl) {
      await teacherWindow.locator('#allowedURL').fill(resourceUrl);
    }
    await teacherWindow.locator('.swal2-confirm').click();

    const resourceName = resourcePath ? path.basename(resourcePath) : resourceUrl;
    await expect(teacherWindow.locator(`[title="${resourceName}"]`)).toBeVisible({ timeout: 30_000 });
  }
}



async function startExam(teacherWindow, studentWindow, locatorString, urlSubstring, state = 'visible') {
  await teacherWindow.locator('[data-e2e="start-exam"]').click();
  await expect.poll(() => studentWindow.url(), { timeout: 60_000 }).toContain(urlSubstring);
  const locator = studentWindow.locator(locatorString);
  if (state === 'attached') await expect(locator).toBeAttached({ timeout: 60_000 });
  else await expect(locator).toBeVisible({ timeout: 60_000 });
}

const modes = [
  {
    name: 'Sprachen',
    modeKey: 'editor',
    resources: [],
    // Completes and submits an editor exam.
    run: async ({ teacherWindow, studentWindow, studentWidget }) => {
      await test.step('teacher starts the exam and student receives the editor', async () => {
        await startExam(teacherWindow, studentWindow, '#editorcontent .ProseMirror', '/editor/');
      });
      await test.step('student writes an answer', async () => {
        const editor = studentWindow.locator('#editorcontent .ProseMirror');
        await editor.fill('This answer was written by the end-to-end test.');
        await expect(editor).toContainText('This answer was written by the end-to-end test.');
      });
      await test.step('student generates the final preview and submits the exam', async () => {
        const finishButton = studentWindow.getByLabel('e2e-finish-exam');
        await expect(finishButton).toBeVisible({ timeout: 60_000 });
        await finishButton.click();
        const sendButton = studentWindow.getByLabel('e2e-send-exam');
        await expect(sendButton).toBeVisible({ timeout: 60_000 });
        await sendButton.dispatchEvent('click');
        await expect(studentWindow.locator('.swal2-title')).toContainText(
          /saved|gespeichert|gesichert/i,
          { timeout: 60_000 }
        );
      });
      await test.step('teacher receives the submitted exam', async () => {
        await expect(studentWidget.locator('button.btn-teal')).toBeVisible({ timeout: 45_000 });
      });
    }
  }, 
  {
    name: 'Mathematik',
    modeKey: 'math',
    resources: [],
    // Completes a GeoGebra task and sends the saved work to the teacher.
    run: async ({ teacherWindow, studentWindow, examName, studentName }) => {
      await test.step('teacher starts the exam and student receives GeoGebra', async () => {
        await startExam(teacherWindow, studentWindow, '.GeoGebraFrame', '/math/');
      });
      await test.step('student solves a task in GeoGebra', async () => {
        await expect.poll(() => studentWindow.evaluate(() => (
          typeof window.ggbApplet?.evalCommand === 'function' && typeof window.ggbApplet?.exists === 'function'
        )), { timeout: 60_000 }).toBe(true);
        await studentWindow.evaluate(() => window.ggbApplet.evalCommand('f(x)=x^2'));
        await expect.poll(() => studentWindow.evaluate(() => window.ggbApplet.exists('f'))).toBe(true);
        const saveResult = await studentWindow.evaluate(async (filename) => {
          const content = await new Promise((resolve) => window.ggbApplet.getBase64(resolve));
          return window.ipcRenderer.invoke('saveGGB', { filename, content, reason: 'manual' });
        }, `${studentName}.ggb`);
        expect(saveResult.status).toBe('success');
      });
      await test.step('teacher collects the saved GeoGebra file', async () => {
        await teacherWindow.locator('[data-e2e="collect-files"]').click();
        const receivedWorkDirectory = path.join(os.homedir(), 'EXAM-TEACHER', examName, studentName);
        await expect.poll(async () => {
          try {
            return (await fs.readdir(receivedWorkDirectory, { recursive: true })).some((file) => file.endsWith('.ggb'));
          } catch {
            return false;
          }
        }, { timeout: 45_000 }).toBe(true);
      });
    }
  },
  {
    name: 'Website',
    modeKey: 'website',
    resources: [],
    // Configures the website that must open when the exam starts.
    configure: async ({ teacherWindow, websiteUrl }) => {
      await teacherWindow.locator('.basematerial-sidebar-block').filter({ hasText: 'Website' }).locator('.sidebar-pick-btn').click();
      await expect(teacherWindow.locator('.swal2-popup')).toBeVisible();
      await teacherWindow.locator('input.swal2-input').fill(websiteUrl);
      await teacherWindow.locator('.swal2-confirm').click();
      await expect(teacherWindow.locator(`[title="${websiteUrl}"]`)).toBeVisible();
    },
    // Starts a website exam and verifies the configured page is loaded.
    run: async ({ teacherWindow, studentWindow, websiteUrl }) => {
      await test.step('teacher starts the exam and student receives the website', async () => {
        await startExam(teacherWindow, studentWindow, '#webviewmain', '/website/', 'attached');
        const webview = studentWindow.locator('#webviewmain');
        await expect(webview).toHaveAttribute('src', websiteUrl, { timeout: 60_000 });
        await expect.poll(() => webview.evaluate((element) => !element.isLoading()), {
          timeout: 60_000
        }).toBe(true);
      });
    }
  },
  {
    name: 'Active Sheets',
    modeKey: 'activesheets',
    resources: [],
    // Adds a real PDF worksheet to the exam.
    configure: async ({ teacherWindow }) => {
      const fileChooserPromise = teacherWindow.waitForEvent('filechooser');
      await teacherWindow.locator('.basematerial-sidebar-block').locator('.sidebar-pick-btn').click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(path.join(repoRoot, 'student', 'public', 'demo.pdf'));
      await expect(teacherWindow.locator('[title="demo.pdf"]')).toBeVisible({ timeout: 60_000 });
      await teacherWindow.locator('#closePDF').click({ timeout: 60_000 });
    },
    // Starts an Active Sheets exam and verifies that the PDF is rendered.
    run: async ({ teacherWindow, studentWindow }) => {
      await test.step('teacher starts the exam and student receives the PDF worksheet', async () => {
        await startExam(teacherWindow, studentWindow, '#pdfrenderer .pdf-page-wrapper', '/activesheets/');
      });
    }
  }
]

for (const mode of modes) {
  test.describe(`exam flow in ${mode.name} mode`, () => {
    test('student completes the exam flow', async () => {
      test.setTimeout(180_000);

      const examName = `e2e-${Date.now().toString().slice(-8)}`;
      const studentName = 'e2e-student';
      let examPin;
      const profileRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'next-exam-e2e-'));
      let teacherApp;
      let studentApp;
      let websiteServer;
      let websiteUrl;

      try {
        if (mode.modeKey === 'website') {
          const website = await startWebsiteServer();
          websiteServer = website.server;
          websiteUrl = website.url;
        }
        let teacherWindow;
        let studentWindow;

        await test.step('launch the teacher application', async () => {
          teacherApp = await electron.launch({
            args: [teachMain, `--user-data-dir=${path.join(profileRoot, 'teacher')}`],
            cwd: path.join(repoRoot, 'teacher'),
            env: { ...process.env, DEBUG: '1', NXE_E2E_SERVER_API_PORT: serverApiPort }
          });
          teacherWindow = await getAppWindow(teacherApp);
          teacherWindow.setDefaultTimeout(30_000);
          await expect(teacherWindow.locator('#q-app')).toBeVisible();
        });

        await test.step('launch the student application', async () => {
          studentApp = await electron.launch({
            args: [studMain, `--user-data-dir=${path.join(profileRoot, 'student')}`],
            cwd: path.join(repoRoot, 'student'),
            env: { ...process.env, DEBUG: '1', NXE_E2E_SERVER_API_PORT: serverApiPort }
          });
          studentWindow = await getAppWindow(studentApp);
          studentWindow.setDefaultTimeout(30_000);
          await expect(studentWindow.locator('#q-app')).toBeVisible();
        });

        await test.step('place both windows side by side and configure the isolated test port', async () => {
          await Promise.all([
            placeWindow(teacherApp, 'left'),
            placeWindow(studentApp, 'right')
          ]);
          await expect.poll(() => studentWindow.evaluate(() => Boolean(
            document.querySelector('#q-app')?.__vue_app__?.config.globalProperties.$pinia
          )), { timeout: 60_000 }).toBe(true);
          await studentWindow.evaluate((port) => {
            const app = document.querySelector('#q-app').__vue_app__;
            app.config.globalProperties.$pinia._s.get('config').serverApiPort = Number(port);
            // No screen picker in CI: screenshot capture is not part of this test.
            navigator.mediaDevices.getDisplayMedia = () => Promise.reject(new Error('e2e: screen capture disabled'));
          }, serverApiPort);
        });

        await test.step(`teacher creates an ${mode.name} exam`, async () => {
          const serverNameInput = teacherWindow.locator('#servername');
          await expect(serverNameInput).toBeVisible({ timeout: 30_000 });
          await serverNameInput.fill(examName);
          await expect(serverNameInput).toHaveValue(examName);
          const startupDialog = teacherWindow.locator('.swal2-container');
          if (await startupDialog.isVisible()) {
            await startupDialog.locator('.swal2-confirm').click();
            await expect(startupDialog).toBeHidden();
          }
          await teacherWindow.locator('#examstart').click();
          await expect(teacherWindow.locator('#studentslist')).toBeVisible();
          await teacherWindow.locator('[data-e2e="exam-mode-toggle"]').click();
          await teacherWindow.locator(`[data-e2e="exam-mode-${mode.modeKey}"]`).click();
          await mode.configure?.({ teacherWindow, websiteUrl });
          await addCustomResources(teacherWindow, mode.resources);
        });

        await test.step('student discovers the exam and registers', async () => {
          examPin = (await teacherWindow.locator('[data-e2e="exam-pin"]').textContent()).trim();
          expect(examPin).toMatch(/^\d{4}$/);
          const studentNameInput = studentWindow.locator('#user');
          await studentNameInput.evaluate((input, value) => {
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }, studentName);
          await expect(studentNameInput).toHaveValue(studentName);
          await studentWindow.locator('#pin').fill(examPin);
          await expect(studentWindow.locator('#pin')).toHaveValue(examPin);
          const startupDialog = studentWindow.locator('.swal2-container');
          if (await startupDialog.isVisible()) {
            await startupDialog.locator('.swal2-confirm').click();
            await expect(startupDialog).toBeHidden();
          }
          await studentWindow.getByLabel('e2e-manual-search').check();
          await studentWindow.getByLabel('e2e-server-ip').fill('127.0.0.1');
          await studentWindow.locator(`[aria-label="e2e-register-${examName}"]`).click({ timeout: 60_000 });
          await expect(studentWindow.locator('.swal2-title')).toHaveText('OK', { timeout: 30_000 });
        });

        const studentWidget = teacherWindow.locator('.studentwidget').filter({ hasText: studentName });
        await test.step('teacher sees the registered student', async () => {
          await expect(studentWidget).toBeVisible({ timeout: 45_000 });
        });
        await mode.run({ teacherWindow, studentWindow, studentWidget, examName, studentName, websiteUrl });

        await test.step('teacher ends the exam', async () => {
          await teacherWindow.locator('[data-e2e="end-exam"]').click();
          await teacherWindow.locator('.swal2-confirm').click();
        });
      } finally {
        await studentApp?.evaluate(({ BrowserWindow }) => {
          for (const window of BrowserWindow.getAllWindows()) window.allowexit = true;
        }).catch(() => {});
        await studentApp?.close();
        await teacherApp?.close();
        if (websiteServer) await new Promise((resolve) => websiteServer.close(resolve));
        await fs.rm(profileRoot, { recursive: true, force: true });
        if (examPin) await fs.rm(path.join(os.homedir(), 'EXAM-STUDENT', `${examName}-${examPin}`), { recursive: true, force: true });
        await fs.rm(path.join(os.homedir(), 'EXAM-TEACHER', examName), { recursive: true, force: true });
      }
    });
})}
