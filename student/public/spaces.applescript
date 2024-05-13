
tell application "Mission Control" to launch
delay 0.5
tell application "System Events"
	try
		tell list 1 of group 2 of group 1 of group 1 of process "Dock"
			set countSpaces to count of buttons
			
			repeat until countSpaces is 1
				set countSpaces to count of buttons
				if countSpaces is greater than 1 then
					perform action "AXRemoveDesktop" of button countSpaces
				end if
			end repeat
			key code 53 -- # Esc
			click button 1
		end tell
	end try
end tell

