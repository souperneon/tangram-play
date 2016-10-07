import React from 'react';
import { connect } from 'react-redux';
import { debounce } from 'lodash';
import localforage from 'localforage';
import EditorTabs from './EditorTabs';
import EditorCallToAction from './EditorCallToAction';
import IconButton from './IconButton';
import DocsPanel from './DocsPanel';
import { initEditor, editor, getEditorContent, setEditorContent } from '../editor/editor';
import { highlightRanges, getAllHighlightedLines } from '../editor/highlight';
import Divider from './Divider';
import { replaceHistoryState } from '../tools/url-state';
import { loadScene, tangramLayer } from '../map/map';

import store from '../store';
import { MARK_FILE_DIRTY, MARK_FILE_CLEAN, SET_SETTINGS } from '../store/actions';

const STORAGE_LAST_EDITOR_STATE = 'last-scene';


let docsHasInitAlready = false;

// If editor is updated, send it to the map.
function updateContent(content) {
    const url = URL.createObjectURL(new Blob([content]));
    loadScene(url);
}

// Wrap updateContent() in a debounce function to prevent rapid series of
// changes from continuously updating the map.
const debouncedUpdateContent = debounce(updateContent, 500);

function updateLocalMemory(content, doc, isClean) {
    // Bail if embedded
    if (window.isEmbedded) {
        return;
    }

    const scene = store.getState().scene;
    const activeFile = scene.activeFileIndex;

    // TODO: Calculate our own config_path and do it much earlier than this
    scene.originalBasePath = tangramLayer.scene.config_path;
    scene.files[activeFile].contents = content;
    scene.files[activeFile].isClean = isClean;
    scene.files[activeFile].scrollInfo = editor.getScrollInfo();
    scene.files[activeFile].cursor = doc.getCursor();
    scene.files[activeFile].highlightedLines = getAllHighlightedLines();

    // Store in local memory
    localforage.setItem(STORAGE_LAST_EDITOR_STATE, scene);
}

// Wrap updateLocalMemory() in a debounce function. It is possible this
// incurs significant processing overhead on every edit so we keep it from
// executing all the time.
const debouncedUpdateLocalMemory = debounce(updateLocalMemory, 500);

function watchEditorForChanges() {
    const content = getEditorContent();
    const doc = editor.getDoc();
    const isClean = doc.isClean();

    // Update all the properties of the active file in local memory.
    // Localforage is async so it cannot be relied on to do this on the
    // window.beforeunload event; there is no guarantee the transaction is
    // completed before the page tears down. See here:
    // https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB#Warning_About_Browser_Shutdown
    debouncedUpdateLocalMemory(content, doc, isClean);

    // Send scene data to Tangram
    debouncedUpdateContent(content);

    // Update the page URL. When editor contents changes by user input
    // and the the editor state is not clean), we erase the ?scene= state
    // from the URL string. This prevents a situation where reloading (or
    // copy-pasting the URL) loads the scene file from an earlier state.
    if (isClean === false) {
        replaceHistoryState({
            scene: null,
        });

        // Also use this area to mark the state of the file in Redux store
        // TODO: These checks do not have to be debounced for Tangram.
        store.dispatch({
            type: MARK_FILE_DIRTY,
            fileIndex: 0,
        });
    } else {
        store.dispatch({
            type: MARK_FILE_CLEAN,
            fileIndex: 0,
        });
    }
}

class Editor extends React.PureComponent {
    componentDidMount() {
        // instantiate CodeMirror with the editor container element's
        // DOM node reference
        initEditor(this.editorEl);

        // Turn change watching on.
        editor.on('changes', watchEditorForChanges);
    }

    componentDidUpdate(prevProps, prevState) {
        // Set content of editor based on currently active file.
        // When incoming props for file content changes we set the state
        // of the editor directly. This only runs if the scene has changed, or
        // if the active tab has changed.
        if ((this.props.sceneCounter > prevProps.sceneCounter) ||
            (this.props.activeFile !== prevProps.activeFile)) {
            // Turn off watching for changes in editor.
            editor.off('changes', watchEditorForChanges);

            // If no active file, clear editor buffer.
            if (this.props.activeFile < 0) {
                setEditorContent('', true);
            } else {
                const activeFile = this.props.files[this.props.activeFile];

                // If there is an active CodeMirror document buffer, we swap out the document.
                if (activeFile && activeFile.buffer) {
                    editor.swapDoc(activeFile.buffer);
                } else if (activeFile && activeFile.contents) {
                    // Mark as "clean" if the contents are freshly loaded
                    // (there is no isClean property defined) or if contents
                    // have been restored with the isClean property set to "true"
                    // This is converted from JSON so the value is a string, not
                    // a Boolean. Otherwise, the document has not been previously
                    // saved and it is left in the "dirty" state.
                    const shouldMarkClean = (typeof activeFile.isClean === 'undefined' ||
                        activeFile.isClean === 'true');

                    // Use the text content and (TODO: reparse)
                    setEditorContent(activeFile.contents, shouldMarkClean);
                }

                // Highlights lines, if provided.
                if (activeFile.highlightedLines) {
                    highlightRanges(activeFile.highlightedLines);
                }

                // Restores the part of the document that was scrolled to, if provided.
                if (activeFile && activeFile.scrollInfo) {
                    const left = activeFile.scrollInfo.left || 0;
                    const top = activeFile.scrollInfo.top || 0;
                    editor.scrollTo(left, top);
                }

                if (window.isEmbedded === undefined) {
                    // Restore cursor position, if provided.
                    if (activeFile && activeFile.cursor) {
                        editor.getDoc().setCursor(activeFile.cursor, {
                            scroll: false,
                        });
                    }
                }
            }

            // Turn change watching back on.
            editor.on('changes', watchEditorForChanges);
        }

        // DocsPanel is only available behind an admin flag.
        // Update after props have determined sign-in, and init docsPanel.
        // Only do this once.
        if (!docsHasInitAlready && this.props.admin) {
            this.docsPanel.init();
            docsHasInitAlready = true;
        }
    }

    /**
     * Hides the editor pane.
     * This does so really simply; it updates the position of the divider to the
     * current window width (to make it go as far to the right as possible).
     * The Divider component will take care of the rest.
     */
    onClickHideEditor(event) {
        store.dispatch({
            type: SET_SETTINGS,
            dividerPositionX: window.innerWidth,
        });
    }

    render() {
        const customStyles = {};
        if (this.props.fontSize) {
            customStyles.fontSize = `${this.props.fontSize.toString()}px`;
        }

        return (
            /* id='content' is used only as a hook for Divider right now */
            <div className="editor-container" id="content">
                <Divider />
                {(() => {
                    // Don't flash this when Tangram Play is initializing;
                    // files are still zero, but we won't prompt until after
                    if (!this.props.appInitialized) return null;

                    if (this.props.files.length === 0) {
                        return (
                            <EditorCallToAction />
                        );
                    }
                    return null;
                })()}
                <EditorTabs />
                <IconButton
                    className="editor-collapse-button"
                    icon="bt-caret-right"
                    tooltip="Hide editor"
                    onClick={this.onClickHideEditor}
                />

                <div
                    className="editor"
                    id="editor"
                    ref={(ref) => { this.editorEl = ref; }}
                    style={customStyles}
                />

                {(() => {
                    if (this.props.admin) {
                        return (
                            <DocsPanel ref={(ref) => { this.docsPanel = ref; }} />
                        );
                    }
                    return null;
                })()}
            </div>
        );
    }
}

Editor.propTypes = {
    admin: React.PropTypes.bool,
    sceneCounter: React.PropTypes.number,
    activeFile: React.PropTypes.number,
    files: React.PropTypes.array,
    appInitialized: React.PropTypes.bool,
    fontSize: React.PropTypes.number,
};

Editor.defaultProps = {
    admin: false,
    activeFile: -1,
    files: [],
};

function mapStateToProps(state) {
    return {
        admin: state.user.admin || false,
        sceneCounter: state.scene.counter,
        activeFile: state.scene.activeFileIndex,
        files: state.scene.files,
        appInitialized: state.app.initialized,
        fontSize: state.settings.editorFontSize,
    };
}

export default connect(mapStateToProps)(Editor);
