// Disable Windows Keys
// https://bblanchon.github.io/disable-windows-keys
// Copyright (C) 2020  Benoit Blanchon

#include "shared.h"
#include "stdafx.h"

LRESULT CALLBACK HookProc(int nCode, WPARAM wParam, LPARAM lParam) {
  if (nCode == HC_ACTION) {
    assert(wParam == WM_KEYDOWN || wParam == WM_KEYUP ||
           wParam == WM_SYSKEYDOWN || wParam == WM_SYSKEYUP);

    DWORD vkCode = ((KBDLLHOOKSTRUCT *)lParam)->vkCode;
    KBDLLHOOKSTRUCT *pKeyBoard = (KBDLLHOOKSTRUCT *)lParam;

    if (vkCode == VK_LWIN || vkCode == VK_RWIN ||
        (vkCode == VK_TAB && (pKeyBoard->flags & LLKHF_ALTDOWN)) || // Alt + Tab
        (vkCode == VK_ESCAPE && (pKeyBoard->flags & LLKHF_ALTDOWN)) || // Alt + Escape
        (vkCode == VK_ESCAPE && (GetAsyncKeyState(VK_CONTROL) & 0x8000) && (GetAsyncKeyState(VK_SHIFT) & 0x8000)) || // Ctrl + Shift + Esc (Task Manager)
        (vkCode == VK_ESCAPE && (GetAsyncKeyState(VK_CONTROL) & 0x8000)) || // Ctrl + Esc (Start menu)
        (vkCode == VK_F4 && (pKeyBoard->flags & LLKHF_ALTDOWN)) || // Alt + F4 (close window)
        (vkCode == VK_SPACE && (pKeyBoard->flags & LLKHF_ALTDOWN)) || // Alt + Space (window system menu)
        ((vkCode == VK_CONTROL && (pKeyBoard->flags & LLKHF_ALTDOWN)) && vkCode == VK_DELETE) || // Ctrl + Alt + Delete - WONT WORK because of windows limitations !!!
        ((vkCode == VK_CONTROL && vkCode == VK_MENU && vkCode == VK_DELETE)) // Ctrl + Alt + Delete
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