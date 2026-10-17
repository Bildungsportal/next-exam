export const executeJavaScript = `
                    (() => {
                        if (!window.__nxeScratchExamHideInit) {
                            window.__nxeScratchExamHideInit = true;
                            const style = document.createElement('style');
                            style.id = '__nxeScratchExamHide__';
                            style.textContent = '[class*="menu-bar_account-info-group"]{display:none!important;}';
                            document.head.appendChild(style);
                            const hideScratchLoadMenu = () => {
                                document.querySelectorAll('[data-menu-item="true"]').forEach((el) => {
                                    const t = (el.textContent || '').trim().toLowerCase();
                                    if (t.includes('load from your computer') || t.includes('von deinem computer laden')) {
                                        el.style.display = 'none';
                                        el.setAttribute('aria-hidden', 'true');
                                    }
                                });
                            };
                            hideScratchLoadMenu();
                            const obs = new MutationObserver(hideScratchLoadMenu);
                            obs.observe(document.documentElement, { childList: true, subtree: true });
                        }
                        const visitFiber = (f) => {
                            if (!f) return null;
                            const vm = f.memoizedProps?.vm || f.pendingProps?.vm || f.stateNode?.props?.vm;
                            if (vm?.loadProject) return vm;
                            return visitFiber(f.child) || visitFiber(f.sibling);
                        };
                        window.__nxeFindScratchVm = () => {
                            for (const root of document.querySelectorAll('#app, body > div')) {
                                const fiberKey = Object.keys(root).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
                                if (!fiberKey) continue;
                                const vm = visitFiber(root[fiberKey]);
                                if (vm) return vm;
                            }
                            for (const el of document.querySelectorAll('*')) {
                                const fiberKey = Object.keys(el).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
                                if (!fiberKey) continue;
                                let f = el[fiberKey];
                                while (f) {
                                    const store = f.memoizedProps?.store || f.stateNode?.store;
                                    const storeVm = store?.getState?.()?.scratchGui?.vm;
                                    if (storeVm?.loadProject) return storeVm;
                                    f = f.return;
                                }
                                const vm = visitFiber(el[fiberKey]);
                                if (vm) return vm;
                            }
                            return null;
                        };
                        window.__nxeLoadScratchFromBase64 = async (base64, filename) => {
                            const bin = atob(base64);
                            const bytes = new Uint8Array(bin.length);
                            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                            const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
                            let vm = null;
                            for (let i = 0; i < 24; i++) {
                                vm = window.__nxeFindScratchVm();
                                if (vm?.loadProject) break;
                                await new Promise((r) => setTimeout(r, 250));
                            }
                            if (!vm?.loadProject) return { ok: false, reason: 'no-vm' };
                            try {
                                await vm.loadProject(arrayBuffer);
                                return { ok: true };
                            } catch (err) {
                                return { ok: false, reason: err?.message || String(err) };
                            }
                        };
                        window.__nxeExportScratchSb3 = async () => {
                            let vm = window.__nxeFindScratchVm();
                            if (!vm?.saveProjectSb3) {
                                for (let i = 0; i < 8; i++) {
                                    await new Promise((r) => setTimeout(r, 250));
                                    vm = window.__nxeFindScratchVm();
                                    if (vm?.saveProjectSb3) break;
                                }
                            }
                            if (!vm?.saveProjectSb3) return { ok: false, reason: 'no-vm' };
                            try {
                                const blob = await vm.saveProjectSb3();
                                const buf = await blob.arrayBuffer();
                                const bytes = new Uint8Array(buf);
                                let bin = '';
                                const chunk = 0x8000;
                                for (let i = 0; i < bytes.length; i += chunk) {
                                    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
                                }
                                return { ok: true, base64: btoa(bin) };
                            } catch (err) {
                                return { ok: false, reason: err?.message || String(err) };
                            }
                        };
                    })();
                `