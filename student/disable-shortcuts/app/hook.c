// Disable Windows Keys
// https://bblanchon.github.io/disable-windows-keys
// Copyright (C) 2020  Benoit Blanchon

#include "shared.h"
#include "stdafx.h"

#ifndef LLKHF_LOWER_IL_INJECTED
#define LLKHF_LOWER_IL_INJECTED 0x2
#endif

LRESULT CALLBACK HookProc(int nCode, WPARAM wParam, LPARAM lParam) {
  if (nCode == HC_ACTION) {
    assert(wParam == WM_KEYDOWN || wParam == WM_KEYUP ||
           wParam == WM_SYSKEYDOWN || wParam == WM_SYSKEYUP);

    DWORD vkCode = ((KBDLLHOOKSTRUCT *)lParam)->vkCode;
    KBDLLHOOKSTRUCT *pKeyBoard = (KBDLLHOOKSTRUCT *)lParam;

    // Block injected keystrokes (SendInput etc.); may break assistive tools / some legit apps; does not catch hardware macro devices or kernel drivers.
    if ((pKeyBoard->flags & LLKHF_INJECTED) != 0 ||
        (pKeyBoard->flags & LLKHF_LOWER_IL_INJECTED) != 0) {
      if (wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN) {
        HWND hwnd = FindWindow(MAIN_WINDOW_CLASS, 0);
        if (hwnd)
          PostMessage(hwnd, WM_KEYPRESS_INTERCEPTED, 0, 0);
      }
      return 1;
    }

    if (vkCode == VK_LWIN || vkCode == VK_RWIN ||
        (vkCode == VK_TAB && (pKeyBoard->flags & LLKHF_ALTDOWN)) || // Alt + Tab
        (vkCode == VK_ESCAPE && (pKeyBoard->flags & LLKHF_ALTDOWN)) || // Alt + Escape
        (vkCode == VK_ESCAPE && (GetAsyncKeyState(VK_CONTROL) & 0x8000) && (GetAsyncKeyState(VK_SHIFT) & 0x8000)) || // Ctrl + Shift + Esc (Task Manager)
        (vkCode == VK_ESCAPE && (GetAsyncKeyState(VK_CONTROL) & 0x8000)) || // Ctrl + Esc (Start menu)
        (vkCode == VK_F4 && (pKeyBoard->flags & LLKHF_ALTDOWN)) || // Alt + F4 (close window)
        (vkCode == VK_SPACE && (pKeyBoard->flags & LLKHF_ALTDOWN)) || // Alt + Space (window system menu)
        (vkCode == VK_DELETE && (GetAsyncKeyState(VK_CONTROL) & 0x8000) && (GetAsyncKeyState(VK_MENU) & 0x8000)) // Ctrl+Alt+Delete: notify only; SAS is not suppressible from this hook
    ) {
                    
      // Notify app
      if (wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN) {
        HWND hwnd = FindWindow(MAIN_WINDOW_CLASS, 0);
        if (hwnd)
          PostMessage(hwnd, WM_KEYPRESS_INTERCEPTED, 0, 0);
      }

      // Stop propagation
      return 1;
    }
   
  }

  // Propagate the event
  return CallNextHookEx(NULL, nCode, wParam, lParam);
}