on join_lines(the_items)
	set AppleScript's text item delimiters to linefeed
	set joined_text to the_items as text
	set AppleScript's text item delimiters to ""
	return joined_text
end join_lines

on list_album_names()
	tell application "Photos"
		set album_names to name of albums
	end tell
	return join_lines(album_names)
end list_album_names

on export_album_files(album_name, export_dir)
	set exported_paths to {}
	tell application "Photos"
		set matching_albums to albums whose name is album_name
		if (count of matching_albums) is 0 then
			error "Album not found: " & album_name
		end if
		
		set target_album to item 1 of matching_albums
		repeat with media_item in (media items of target_album)
			export {media_item} to POSIX file export_dir with using originals
		end repeat
	end tell
	
	set exported_shell_output to do shell script "find " & quoted form of export_dir & " -type f | sort"
	if exported_shell_output is "" then
		return ""
	end if
	return exported_shell_output
end export_album_files

on run argv
	if (count of argv) is 0 then
		error "Missing command"
	end if
	
	set command_name to item 1 of argv
	
	if command_name is "list-albums" then
		return list_album_names()
	else if command_name is "sync" then
		if (count of argv) is less than 3 then
			error "sync requires album name and export directory"
		end if
		
		set album_name to item 2 of argv
		set export_dir to item 3 of argv
		return export_album_files(album_name, export_dir)
	else
		error "Unknown command: " & command_name
	end if
end run
