// Disable Windows Keys
// https://bblanchon.github.io/disable-windows-keys
// Copyright (C) 2020  Benoit Blanchon

#include "mainwindow.h"
#include "resource.h"
#include "shared.h"
#include "stdafx.h"

#define INTERCEPT_FLASH_TIMER_ID 1
#define INTERCEPT_FLASH_MS 180
#define INTERCEPT_FLASH_BACKGROUND RGB(72, 28, 28)
#define TEXT_COLOR RGB(255, 255, 255)
#define BACKGROUND_COLOR RGB(33, 37, 41)
#define PADDING_TOP 20
#define PADDING_BOTTOM 30
#define PADDING_RIGHT 30
#define PADDING_LEFT 30
#define MAIN_WINDOW_STYLE                                                      \
  (WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX)

static HFONT hFont;
static HPEN hPen;
static BOOL s_interceptFlashActive;

static void DrawExplanationText(HDC hdc, RECT *rect, UINT format) {
  HINSTANCE hInstance = GetModuleHandle(NULL);

  TCHAR szExplanation[128];
  size_t nExplanation = LoadString(hInstance, IDS_EXPLANATION, szExplanation,
                                   ARRAYSIZE(szExplanation));

  SetTextColor(hdc, TEXT_COLOR);
  SetBkMode(hdc, TRANSPARENT);
  SelectObject(hdc, hFont);
  DrawText(hdc, szExplanation, nExplanation, rect, format);
}

static void OnPaint(HWND hwnd) {
  PAINTSTRUCT ps;
  HDC hdc = BeginPaint(hwnd, &ps);

  RECT client;
  GetClientRect(hwnd, &client);
  COLORREF bg =
      s_interceptFlashActive ? INTERCEPT_FLASH_BACKGROUND : BACKGROUND_COLOR;
  HBRUSH bgBrush = CreateSolidBrush(bg);
  FillRect(hdc, &client, bgBrush);
  DeleteObject(bgBrush);

  RECT rect = client;
  rect.top += PADDING_TOP;
  rect.left += PADDING_LEFT;
  rect.bottom -= PADDING_BOTTOM;
  rect.right -= PADDING_RIGHT;
  DrawExplanationText(hdc, &rect, DT_TOP | DT_LEFT | DT_NOCLIP);

  EndPaint(hwnd, &ps);
}

// Clears the brief client-area flash after an intercepted key.
static void OnTimer(HWND hwnd, UINT_PTR uTimerID) {
  if (uTimerID != INTERCEPT_FLASH_TIMER_ID)
    return;
  KillTimer(hwnd, INTERCEPT_FLASH_TIMER_ID);
  s_interceptFlashActive = FALSE;
  InvalidateRect(hwnd, NULL, FALSE);
}

// Shows a short background tint so a blocked shortcut or injected key is visible in the window.
static void OnKeypressIntercepted(HWND hwnd) {
  s_interceptFlashActive = TRUE;
  InvalidateRect(hwnd, NULL, FALSE);
  KillTimer(hwnd, INTERCEPT_FLASH_TIMER_ID);
  SetTimer(hwnd, INTERCEPT_FLASH_TIMER_ID, INTERCEPT_FLASH_MS, NULL);
}

static LRESULT CALLBACK WindowProc(HWND hwnd, UINT message, WPARAM wParam,
                                   LPARAM lParam) {

  switch (message) {
  case WM_KEYPRESS_INTERCEPTED:
    OnKeypressIntercepted(hwnd);
    break;

  case WM_TIMER:
    OnTimer(hwnd, wParam);
    break;

  case WM_ERASEBKGND:
    return 1;

  case WM_PAINT:
    OnPaint(hwnd);
    break;

  case WM_DESTROY:
    KillTimer(hwnd, INTERCEPT_FLASH_TIMER_ID);
    PostQuitMessage(0);
    break;

  default:
    return DefWindowProcW(hwnd, message, wParam, lParam);
  }
  return 0;
}

void RegisterMainWindowClass(HINSTANCE hInstance) {
  WNDCLASSEX wcex = {sizeof(WNDCLASSEX)};
  wcex.style = CS_HREDRAW | CS_VREDRAW;
  wcex.lpfnWndProc = WindowProc;
  wcex.cbClsExtra = 0;
  wcex.cbWndExtra = 0;
  wcex.hInstance = hInstance;
  wcex.hIcon = LoadIcon(hInstance, MAKEINTRESOURCE(IDI_APPICON));
  wcex.hCursor = 0;
  wcex.hbrBackground = CreateSolidBrush(BACKGROUND_COLOR);
  wcex.lpszMenuName = 0;
  wcex.lpszClassName = MAIN_WINDOW_CLASS;
  wcex.hIconSm = 0;
  RegisterClassEx(&wcex);

  hFont = CreateFont(32, 0, 0, 0, FW_LIGHT, FALSE, FALSE, FALSE,
                     DEFAULT_CHARSET, OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS,
                     PROOF_QUALITY, FF_SWISS, TEXT("Segoe UI Light"));
}
void MeasureSize(SIZE *sz) {
  RECT rect = {0, 0, 450, 200};

  HDC hdc = GetDC(NULL);
  DrawExplanationText(hdc, &rect, DT_CALCRECT | DT_TOP | DT_LEFT);
  ReleaseDC(NULL, hdc);

  AdjustWindowRect(&rect, MAIN_WINDOW_STYLE, FALSE);

  sz->cx = rect.right - rect.left + PADDING_LEFT + PADDING_RIGHT;
  sz->cy = rect.bottom - rect.top + PADDING_TOP + PADDING_BOTTOM;
}

HWND CreateMainWindow(HINSTANCE hInstance) {
  TCHAR szTitle[32];
  size_t nTitle =
      LoadString(hInstance, IDS_TITLE, szTitle, ARRAYSIZE(szTitle) - 1);
  szTitle[nTitle] = 0;

  SIZE sz;
  MeasureSize(&sz);

  return CreateWindow(MAIN_WINDOW_CLASS, szTitle, MAIN_WINDOW_STYLE,
                      CW_USEDEFAULT, 0, sz.cx, sz.cy, NULL, NULL, hInstance,
                      NULL);
}