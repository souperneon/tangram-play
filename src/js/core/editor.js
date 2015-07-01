//  TODO:
//       - Replace global scene by a local
//
'use strict';

const Utils = require('./common.js');
const Widgets = require('../addons/widgets.js');
const SuggestedKeys = require('../addons/suggestedKeys.js');

// Import CodeMirror
const CodeMirror = require('codemirror');

// Import CodeMirror addons and modules
require('codemirror/addon/search/searchcursor');
require('codemirror/addon/search/search');
require('codemirror/addon/dialog/dialog');
require('codemirror/addon/edit/matchbrackets');
require('codemirror/addon/edit/closebrackets');
require('codemirror/addon/comment/comment');
require('codemirror/addon/wrap/hardwrap');
require('codemirror/addon/fold/foldcode');
require('codemirror/addon/fold/foldgutter');
require('codemirror/addon/fold/indent-fold');
require('codemirror/addon/hint/show-hint');
require('codemirror/addon/display/rulers');
require('codemirror/addon/display/panel');
require('codemirror/keymap/sublime');
require('codemirror/mode/javascript/javascript');

// Import additional parsers
const GLSLTangram = require('../parsers/glsl-tangram.js');
const YAMLTangram = require('../parsers/yaml-tangram.js');

// Temp remap all utility functions to local vars
const debounce = Utils.debounce;
const fetchHTTP = Utils.fetchHTTP;

//  Main CM functions
//  ===============================================================================
var updateContent = debounce(function(cm) {
    var createObjectURL = (window.URL && window.URL.createObjectURL) || (window.webkitURL && window.webkitURL.createObjectURL); // for Safari compatibliity

    //  If doesn't have a API key
    //  inject a Tangram-Play one: vector-tiles-x4i7gmA ( Patricio is the owner )
    var content = cm.getValue();
    var pattern = /(^\s+url:\s+([a-z]|[A-Z]|[0-9]|\/|\{|\}|\.|\:)+mapzen.com([a-z]|[A-Z]|[0-9]|\/|\{|\}|\.|\:)+(topojson|geojson|mvt)$)/gm;
    var result = "$1??api_key=vector-tiles-x4i7gmA"
    content = content.replace(pattern, result);

    if (scene) {
        var url = createObjectURL(new Blob([content]));
        scene.reload(url);
        Widgets.update(cm);
    }
}, 500);

var updateKeys = debounce(function(cm) {
    SuggestedKeys.suggest(cm);
}, 1000);

module.exports = {
    init,
    updateContent,
    updateKeys,
    unfoldAll,
    foldByLevel,
    selectLines,
    loadStyle,
    getContent,
    getInd
}

//  Initialize the editor in a specific DOM and with the context of a style_file
//
function init (dom, style_file) {

    var rulers = [];
    for (var i = 1; i < 10; i++) {
        var b = Math.round((0.88 + i/90)*255);
        rulers.push({   color: 'rgb('+b+','+b+','+b+')',
                        column: i * 4,
                        lineStyle: "dashed"     });
    }

    var cm = CodeMirror(dom ,{
        value: "Loading...",
        rulers: rulers,
        lineNumbers: true,
        matchBrackets: true,
        mode: "text/x-yaml-tangram",
        keyMap: "sublime",
        autoCloseBrackets: true,
        extraKeys: {"Ctrl-Space": "autocomplete",
                    "Tab": function(cm) { cm.replaceSelection(Array(cm.getOption("indentUnit") + 1).join(" ")); },
                    "Alt-F" : function(cm) { cm.foldCode(cm.getCursor(), cm.state.foldGutter.options.rangeFinder); } ,
                    "Alt-P" : function(cm) {takeScreenshot();},
                    "Ctrl-0" : function(cm) {unfoldAll(cm)},
                    "Ctrl-1" : function(cm) {foldByLevel(cm,0)},
                    "Ctrl-2" : function(cm) {foldByLevel(cm,1)},
                    "Ctrl-3" : function(cm) {foldByLevel(cm,2)},
                    "Ctrl-4" : function(cm) {foldByLevel(cm,3)},
                    "Ctrl-5" : function(cm) {foldByLevel(cm,4)},
                    "Ctrl-6" : function(cm) {foldByLevel(cm,5)},
                    "Ctrl-7" : function(cm) {foldByLevel(cm,6)},
                    "Ctrl-8" : function(cm) {foldByLevel(cm,7)}
        },
        foldGutter: {
            rangeFinder: CodeMirror.fold.indent
        },
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        showCursorWhenSelecting: true,
        theme: "tangram",
        lineWrapping: true,
        autofocus: true,
        indentUnit: 4
    });

    //  Hook events

    //  Update Tangram Map when stop typing
    cm.on('change', function (cm, changeObj) {
        if (cm.isSaved) {
            cm.isSaved = false;
        }
    });

    // Update widgets & content after a batch of changes
    cm.on('changes', function (cm, changes) {
        Widgets.update(cm);
        //Widgets.updateWidgetsOnEditorChanges(changes);
        updateContent(cm);
    });

    //  When the viewport change (lines are add or erased)
    cm.on("viewportChange", function(cm, from, to) {
        Widgets.update(cm);
    });

    // cm.on("mousedown", function(event) {
    //     // var cursor = editor.getCursor(true);
    // });

    cm.on("cursorActivity", function(cm) {
        updateKeys(cm);
    });

    cm.getLineInd = function(nLine){
        return getLineInd(this,nLine);
    }

    loadStyle(cm, fetchHTTP(style_file));

    return cm;
};

//  Common IO functions to CM
//  ===============================================================================
function loadStyle(cm, contents) {
    if (contents) {

        contents = contents.replace(/\?api_key\=(\w|\-)*$/gm,"");

        //  Delete API Key
        cm.setValue(contents);
        cm.isSaved = true;

        // TODO:
        //      - instead of deleting the key if should check if
        //      this user owns the key. If it doesn't delete it

    }
}

function getContent(cm) {
    return cm.getValue();
}

//  Common CM functions
//  ===============================================================================

//  Get the indentation level of a line
function getInd(string) { return YAMLTangram.getSpaces(string) / 4;};
function getLineInd(cm, nLine) { return YAMLTangram.getSpaces(cm.lineInfo(nLine).text) / cm.getOption("tabSize"); };


//  Check if a line is empty
function isStrEmpty(str) { return (!str || 0 === str.length || /^\s*$/.test(str)); };
function isEmpty(cm, nLine) { return isStrEmpty(cm.lineInfo(nLine).text); };

//  Check if the line is commented YAML style
function isStrCommented(str) { var regex = /^\s*[\#||\/\/]/gm; return (regex.exec(str) || []).length > 0; };
function isCommented(cm, nLine) { return isStrCommented(cm.lineInfo(nLine).text); };

//  Common NAVIGATION functions on CM
//  ===============================================================================

//  Jump to a specific line
function jumpToLine(cm, nLine) { cm.scrollTo( null, cm.charCoords({line: nLine-1, ch: 0}, "local").top ); };

//  Jump to a specific line
function jumpToLineAt(cm, nLine, offset) {
    var t = cm.charCoords({line: nLine-1, ch: 0}, "local").top;
    cm.scrollTo(null, t);
};

//  Common SELECTION function on CM
//  ===============================================================================

//  Select a line or a range of lines
//
function selectLines(cm, rangeString) {
    var from, to;

    if (isNumber(rangeString)) {
        from = parseInt(rangeString)-1;
        to = from;
    } else {
        var lines = rangeString.split('-');
        from = parseInt(lines[0])-1;
        to = parseInt(lines[1])-1;
    }

    // If folding level is on un fold the lines selected
    if (query['foldLevel']) {
        foldAllBut(cm, from,to,query['foldLevel']);
    }

    cm.setSelection({ line: from, ch:0},
                    { line: to, ch:cm.lineInfo(to).text.length } );
    jumpToLine(cm,from);
};

//  Common FOLD functions on CM
//  ===============================================================================

//  Is posible to fold
//
function isFolder(cm, nLine) {
    if ( cm.lineInfo(nLine).gutterMarkers ) {
        return cm.lineInfo(nLine).gutterMarkers['CodeMirror-foldgutter'] !== null;
    } else {
        return false;
    }
};

//  Select everything except for a range of lines
//
function foldAllBut(cm, From, To, queryLevel) {
    // default level is 0
    queryLevel = typeof queryLevel !== 'undefined' ? queryLevel : 0;

    // fold everything
    foldByLevel(cm, queryLevel);

    // get minimum indentation
    var minLevel = 10;
    var startOn = To;
    var onBlock = true;

    for (var i = From-1; i >= 0; i--) {

        var level = getLineInd(cm, i);

        if (level === 0) {
            break;
        }

        if (level < minLevel) {
            minLevel = level;
        } else if (onBlock) {
            startOn = i;
            onBlock = false;
        }
    }

    minLevel = 10;
    for (var i = To; i >= From; i--) {
        var level = getLineInd(cm, i);
        var chars = cm.lineInfo(i).text.length;
        if (level < minLevel && chars > 0) {
            minLevel = level;
        }
    }
    var opts = cm.state.foldGutter.options;

    for (var i = startOn; i >= 0; i--) {
        var level = getLineInd(cm, i);

        if (level === 0 && cm.lineInfo(i).text.length > 0) {
            break;
        }

        if (level <= minLevel) {
            cm.foldCode({ line: i }, opts.rangeFinder, "fold");
        }
    }

    for (var i = To; i < cm.lineCount() ; i++) {
        if (getLineInd(cm, i) >= queryLevel) {
            cm.foldCode({ line: i }, opts.rangeFinder, "fold");
        }
    }
};

//  Unfold all lines
//
function unfoldAll(cm) {
    var opts = cm.state.foldGutter.options;
    for (var i = 0; i < cm.lineCount() ; i++) {
        cm.foldCode({ line: i }, opts.rangeFinder, "unfold");
    }
};

//  Fold all lines above a specific indentation level
//
function foldByLevel(cm, level) {
    unfoldAll(cm);
    var opts = cm.state.foldGutter.options;

    var actualLine = cm.getDoc().size-1;
    while (actualLine >= 0) {
        if (isFolder(cm, actualLine)) {
            if (getLineInd(cm, actualLine) >= level) {
                cm.foldCode({line:actualLine,ch:0}, opts.rangeFinder);
            }
        }
        actualLine--;
    }
};