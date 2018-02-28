// ==UserScript==
// @name           stackexchange-tab-editing
// @description    Make the tab, home, and backspaces keys in the StackExchange post editor behave more like in a good text editor
// @include        http://stackoverflow.com/*
// @include        http://*.stackoverflow.com/*
// @include        http://serverfault.com/*
// @include        http://superuser.com/*
// @include        http://meta.stackoverflow.com/*
// @include        http://meta.serverfault.com/*
// @include        http://meta.superuser.com/*
// @include        http://stackapps.com/*
// @include        http://*.stackexchange.com/*
// @include        http://askubuntu.com/*
// @include        http://meta.askubuntu.com/*
// @include        http://answers.onstartups.com/*
// @include        http://meta.answers.onstartups.com/*
// @include        http://mathoverflow.net/*
// @include        http://local.mso.com/*
// @exclude        http://chat.*
// @exclude        http://blog.*
// @exclude        http://careers.stackoverflow.com.*
// @author         Benjamin Dumke-von der Ehe
// ==/UserScript==

// (c) 2012 Benjamin Dumke-von der Ehe
// Released under the MIT License

// Thanks to Shog9 for this idea for making the script work in both
// Chrome and Firefox: http://meta.stackoverflow.com/questions/46562 (now deleted)

function with_jquery(f) {
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.textContent = "(" + f.toString() + ")(jQuery)";
    document.body.appendChild(script);
};

with_jquery(function($) { $(function () {
    // are we really really on a Stack Exchange site?
    if (!(window.StackExchange && StackExchange.ready))
        return;
    
    var tabspc = 4,
        tabpad = " ".repeat(tabspc);
    
    var supportsSelectionDirection = "selectionDirection" in $("<textarea />")[0];
    
    function getSelection(jElem) {
        var result = jElem.caret(),
            backward = jElem[0].selectionDirection === "backward";
        // Adjust selection to exclude trailing whitespace
        result.end -= result.text.match(/([ \t\n]*)$/)[0].length;
        if (backward) {
            result.directedStart = result.end;
            result.directedEnd = result.start;
            result.backward = true;
        } else {
            result.directedStart = result.start;
            result.directedEnd = result.end;
        }
        return result;
    }
    
    function setSelection(jElem, start, end, reverse) {
        var _, backward;
        if (arguments.length === 2)
            end = start;
        if (reverse) {
            _ = start;
            start = end;
            end = _;
        }
        if (start > end) {
            _ = start;
            start = end;
            end = _;
            backward = true;
        }
        
        if (backward && supportsSelectionDirection )
            jElem[0].setSelectionRange(start, end, "backward");
        else
            jElem.caret(start, end);
    }
    
    var HANDLERS = {
        9: { handler: tabHandler, allowShift: true },
        36: { handler: homeHandler, allowShift: supportsSelectionDirection },
        8: { handler: backspaceHandler }
    }
    
    var ACTIVE = true,
        CTRL_PRESSED = false;
    
    function toggle(textarea, value) {
        if (typeof value === "undefined")
            value = !ACTIVE;
            
        if (!(ACTIVE ^ value))
            return;
        
        $(textarea).css("opacity", value ? 1 : .3);
        ACTIVE = value;
    }
    
    $("#mainbar").on("keyup", ".wmd-input", function (evt) {
        if (CTRL_PRESSED && evt.which === 17)
            toggle(this);
        else
            toggle(this, true);
    });
        
    $("#mainbar").on("keydown", ".wmd-input", function (evt) {

        CTRL_PRESSED = evt.which === 17;

        if (evt.ctrlKey || evt.altKey || evt.metaKey)
            return true;
        
        var active = ACTIVE;
        toggle(this, true);
        
        if (!active)
            return true;
        
        if (!HANDLERS.hasOwnProperty(evt.which))
            return true;
        
        var handler = HANDLERS[evt.which];
        
        if (evt.shiftKey && !handler.allowShift)
            return true;
        
        return handler.handler.call(this, evt.shiftKey);
        
    });
    
    function backspaceHandler() {
        var jThis = $(this),
            oldMarkdown = this.value || "",
            selection = jThis.caret(),
            preCursorMarkdown = oldMarkdown.substring(0, selection.end),
            lastLine = (preCursorMarkdown.match(/(?:^|\n)([^\n]*)$/) || ["", ""])[1];
        
        // If there's only whitespace before the cursor on the current line, backspace behaves like
        // Shift-Tab. Otherwise, it has native behavior.
        if (/^[ \t]+$/.test(lastLine)) {
            return tabHandler.call(this, true);
        }
        return true;
    }
    
    function homeHandler(shiftKey) {
        var jThis = $(this),
            oldMarkdown = this.value || "",
            selection = getSelection(jThis),
            preCursorMarkdown = oldMarkdown.substring(0, selection.directedEnd),
            postCursorMarkdown = oldMarkdown.substring(selection.directedEnd),
            lastLine = (preCursorMarkdown.match(/(?:^|\n)([^\n]*)$/) || ["", ""])[1],
            firstRealCharPos,
            newCursorPos;
        
        if (!lastLine.length) { // we're at the beginning of the line
            firstRealCharPos = (postCursorMarkdown.match(/^[\t ]*/) || [""])[0].length;
            if (firstRealCharPos > 0)
                newCursorPos = selection.directedEnd + firstRealCharPos;
        } else { // not at the beginning of the line
            firstRealCharPos = lastLine.search(/[^ \t]/);
            
            // if this line isn't indented by at least tabspc spaces or one tab, fall back to native behavior,
            // since that can correctly handle soft line wrapping in the textarea, which we can't
            var re = new RegExp("^ {0,"+(tabspc-1)+"}\t");
            if (firstRealCharPos >= tabspc || (firstRealCharPos > 0 && re.test(lastLine)))
                newCursorPos = selection.directedEnd - lastLine.length + firstRealCharPos;
        }
        
        if (typeof newCursorPos !== "undefined") {
            if (shiftKey)
                setSelection(jThis, selection.directedStart, newCursorPos);
            else
                setSelection(jThis, newCursorPos);
            return false;
        }
        return true;
    }
    
    function tabHandler (shiftKey) {
        var jThis = $(this),
            oldMarkdown = this.value || "",
            selection = getSelection(jThis),
            preSelMarkdown = oldMarkdown.substring(0, selection.start),
            selMarkdown = oldMarkdown.substring(selection.start, selection.end),
            postSelMarkdown = oldMarkdown.substring(selection.end),
            addCount, firstLineAddCount;
            
        if (selection.start === selection.end) {  // Cursor only, no selection
            var lastLine = (preSelMarkdown.match(/(?:^|\n)([^\n]*)$/) || ["", ""])[1],
                skew = 0,
                i;
                
            if (shiftKey && !/(^|[ \t])$/.test(lastLine))
                return false;
                
            var moveCursor = true;
                
            if (shiftKey && !lastLine.length) {
                postSelMarkdown = postSelMarkdown.replace(/^[ \t]*/, function (match) {
                    lastLine = match;
                    preSelMarkdown = preSelMarkdown + match;
                    return "";
                });
                moveCursor = false;
            }
            for (i = 0; i < lastLine.length; i++) {
                if (lastLine.charAt(i) === "\t") {
                    skew = 0;
                } else {
                    skew++;
                }
            }
            
            if (shiftKey) {
                var removeCount = lastLine.length ? skew % tabspc || tabspc : tabspc, // 1 to tabspc
                    re = new RegExp(" {0," + (removeCount - 1) + "}[ \\t]$");
                    
                preSelMarkdown = preSelMarkdown.replace(re, function (match) {
                    addCount = -match.length;
                    return "";
                });
            } else {
                addCount = tabspc - (skew % tabspc);
                preSelMarkdown += tabpad.slice(skew % tabspc);
            }
            jThis.val(preSelMarkdown + postSelMarkdown);
            
            if (!moveCursor)
                addCount = 0;
            jThis.caret(selection.start + addCount, selection.start + addCount);
            
        } else { // it's a selection
            preSelMarkdown = preSelMarkdown.replace(/(^|\n)([^\n]*)$/, function (match, start, line) {
                selMarkdown = line + selMarkdown;
                return start;
            });

            // Check whether the selection starts at the beginning of a line
            var selOffset = (oldMarkdown.substr(selection.start-1,1) === '\n') ? 0 : 1;
            
            if (shiftKey) {
                addCount = 0;
                var re = new RegExp("(^|\n)(\t| {1,"+(tabspc-1)+"}[ \t])","g");
                selMarkdown = selMarkdown.replace(re, function (match, start, indent) {
                    if (!addCount)
                        firstLineAddCount = tabspc-indent.length;
                    addCount -= indent.length;
                    return start;
                }); 
                if(!addCount) return false;  // Whole selection is at left margin
            } else {
                addCount = 0;
                firstLineAddCount = 0;
                selMarkdown = selMarkdown.replace(/^|\n/g, function (match) {
                    addCount += tabspc;
                    return match + tabpad;
                });
            }
            jThis.val(preSelMarkdown + selMarkdown + postSelMarkdown);
            setSelection(jThis, selection.start + firstLineAddCount+(selOffset*addCount), selection.end + addCount, selection.backward);
        }
        return false;
    }
}); });
