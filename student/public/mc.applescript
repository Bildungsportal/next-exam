--  # Check to see if System Preferences is 
--  # running and if yes, then close it.
--  # 
--  # This is done so the script will not fail 
--  # if it is running and a modal sheet is 
--  # showing, hence the use of 'killall' 
--  # as 'quit' fails when done so, if it is.
--  #
--  # This is also done to allow default behaviors
--  # to be predictable from a clean occurrence.


--  # Make sure System Preferences is not running before
--  # opening it again. Otherwise there can be an issue
--  # when trying to reopen it while it's actually closing.

try
	tell application "System Preferences" to quit
on error
	do shell script "killall 'System Preferences'"
end try
delay 0.5

--  # Open System Preferences to Mission Control.

# get entire contents  # use this to see all user interface elements
tell application "System Preferences"
	activate
	set the current pane to pane id "com.apple.preference.keyboard"
end tell

tell application "System Events"
	set isRunning to (name of processes) contains "System Preferences"
end tell


repeat while isRunning is false
	delay 0.1
end repeat


tell application "System Preferences"
	reveal pane "com.apple.preference.keyboard"
	delay 1
end tell

tell application "System Events"
	tell window 1 of application process "System Preferences"
		
		#warten auf das UI
		set i to 0
		repeat until exists tab group 1
			delay 0.1
			set i to i + 1
			if i ≥ 30 then return
		end repeat
		click radio button 3 of tab group 1
	end tell
	
	
	select row 3 of table 1 of scroll area 1 of splitter group 1 of tab group 1 of window 1 of application process "System Preferences"
	tell scroll area 2 of splitter group 1 of tab group 1 of window 1 of application process "System Preferences"
		# get entire contents
		# click checkbox 1 of UI element 1 of row 1 of outline 1 of scroll area 2 of splitter group 1 of tab group 1 of window "Tastatur" of application process "System Preferences" of application "System Events"
		repeat with i from 1 to count rows of outline 1
			tell UI element 1 of row i of outline 1
				if value of checkbox 1 is equal to 1 then click checkbox 1
			end tell
		end repeat
	end tell
end tell



tell application "System Preferences"
	activate
	set the current pane to pane id "com.apple.preference.expose"
end tell

tell application "System Events"
	tell window 1 of application process "System Preferences"
		
		--  Wait until UI ellements are available.
		
		set i to 0
		repeat until exists checkboxes of group 2
			delay 0.1
			set i to i + 1
			if i ≥ 30 then return
		end repeat
		
		--  # Uncheck any checked ckeckboxes.
		tell group 2
			repeat with i from 1 to count checkboxes
				if value of checkbox i is equal to 1 then click checkbox i
			end repeat
		end tell
		
		--  # Set all pop up buttons to: -
		tell group 1
			repeat with i from 1 to count pop up buttons
				if value of pop up button i is not "-" then
					click pop up button i
					pick menu item "-" of menu 1 of pop up button i
				end if
			end repeat
		end tell
		
	end tell
	
end tell






tell application "Mission Control" to launch
delay 0.25
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
		end tell
		delay 0.6
		key code 53 -- # Esc
	end try
end tell


tell application "System Preferences" to quit
