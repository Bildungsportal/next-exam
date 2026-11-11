
tell application "System Preferences"
	activate
	set the current pane to pane id "com.apple.preference.security"
end tell

tell application "System Events"
	tell window 1 of application process "System Preferences"
		
		#warten auf das UI
		set i to 0
		repeat until exists tab group 1
			delay 0.2
			set i to i + 1
			if i ≥ 40 then return
		end repeat
		click radio button 4 of tab group 1
	end tell
	delay 0.2
	select row 9 of table 1 of scroll area 1 of tab group 1 of window 1 of application process "System Preferences"
end tell

tell application "System Preferences" to quit
