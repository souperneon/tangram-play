'use strict';
// For now: assume globals
/* global tangramPlay */

import { saveAs } from "../../vendor/FileSaver.min.js";
import { noop } from './Helpers.js';
import Modal from './Modal.js';

const EditorIO = {
    open (file) {
        this.checkSaveStateThen(() => {
            this.loadContent(file);
        });
    },
    checkSaveStateThen (callback = noop) {
        if (tangramPlay.editor.isSaved === false) {
            const unsavedModal = new Modal('Your style has not been saved. Continue?', callback);
            unsavedModal.show();
        } else {
            callback();
        }
    },
    loadContent (content) {
        const reader = new FileReader();
        reader.onload = function(e) {
            tangramPlay.loadContent(e.target.result);
        };
        reader.readAsText(content);
    },
    saveContent () {
        const typedArray = tangramPlay.getContent();
        const blob = new Blob([typedArray], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, 'style.yaml');
        tangramPlay.editor.isSaved = true;
    }
};

export default EditorIO;
