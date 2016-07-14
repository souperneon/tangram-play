import React from 'react';
import ReactDOM from 'react-dom';
import Modal from 'react-bootstrap/lib/Modal';
import Button from 'react-bootstrap/lib/Button';
import DraggableModal from '../draggable-modal.react';
import Icon from '../icon.react';

import Vector from './vector';
import { editor } from '../../editor/editor';

/**
 * Represents a widget link for a vec2
 */
export default class WidgetLinkVec2 extends React.Component {
    /**
     * Used to setup the state of the component. Regular ES6 classes do not
     * automatically bind 'this' to the instance, therefore this is the best
     * place to bind event handlers
     *
     * @param props - parameters passed from the parent
     */
    constructor (props) {
        super(props);
        this.state = {
            displayPicker: this.props.display
        };

        this.cursor = this.props.cursor;
        this.match = this.props.match;

        this.fnColor = 'rgb(230, 230, 230)';
        this.selColor = 'rgb(40, 168, 107)';
        this.dimColor = 'rgb(100, 100, 100)';

        this.width = 200;
        this.height = 200;

        this.min = -1;
        this.max = 1;
        this.size = 6;
        this.range = this.max - this.min;
        this.overPoint = false;
        this.value = new Vector([0, 0]);

        this.drag = false;

        this.handleClick = this.handleClick.bind(this);
        this.setValue = this.setValue.bind(this);
        this.updateCanvas = this.updateCanvas.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
    }

    /**
     * Widget links are handled slightly differently. For now they are simply unmounted from the DOM and recreated again
     * Meaning, handleClick will only be called once to unmount the widget
     */
    handleClick () {
        this.setState({ displayPicker: !this.state.displayPicker });

        let widgetlink = document.getElementById('widget-links');
        ReactDOM.unmountComponentAtNode(widgetlink);
    }

    componentDidMount () {
        this.updateCanvas();
    }

    setValue (pos) {
        this.value = new Vector(pos);
    }

    updateCanvas () {
        this.ctx = this.refs.canvas.getContext('2d');
        this.ctx.clearRect(0, 0, this.width, this.height);

        // frame
        this.ctx.strokeStyle = this.dimColor;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, this.width, this.height);

        this.ctx.beginPath();
        this.ctx.lineWidth = 0.25;
        let sections = 20;
        let step = this.width / sections;
        for (let i = 0; i < sections; i++) {
            this.ctx.moveTo(i * step, 0);
            this.ctx.lineTo(i * step, this.height);
            this.ctx.moveTo(0, i * step);
            this.ctx.lineTo(this.width, i * step);
        }
        this.ctx.stroke();

        // horizontal line
        this.ctx.strokeStyle = this.dimColor;
        this.ctx.lineWidth = 1.0;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0.5 + this.height * 0.5);
        this.ctx.lineTo(this.width, 0.5 + this.height * 0.5);
        this.ctx.closePath();
        this.ctx.stroke();

        // vertical line
        this.ctx.beginPath();
        this.ctx.moveTo(0.5 + this.width * 0.5, 0);
        this.ctx.lineTo(0.5 + this.width * 0.5, this.height);
        this.ctx.closePath();
        this.ctx.stroke();

        let x = Math.round(((this.value.x - this.min) / this.range) * this.width);
        let y = Math.round(((1 - (this.value.y - this.min) / this.range)) * this.height);

        let half = this.size / 2;

        if (x < half) {
            x = half;
        }
        if (x > this.width - half) {
            x = this.width - half;
        }
        if (y < half) {
            y = half;
        }
        if (y > this.height - half) {
            y = this.height - half;
        }

        // point
        this.ctx.fillStyle = this.overPoint ? this.selColor : this.fnColor;
        this.ctx.beginPath();
        let radius = this.overPoint ? 4 : 3;
        this.ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
        this.ctx.fill();

        this.ctx.restore();
    }

    onMouseDown () {
        this.drag = true;
        this.overPoint = true; // Change the look of the point within the canvas
    }

    onMouseMove (e) {
        if (this.drag === true) {
            let mousePos = this.getMousePos(this.refs.canvas, e);

            let x = mousePos.x;
            let y = mousePos.y;

            this.value.x = ((this.range / this.width) * x) - (this.range - this.max);
            this.value.y = (((this.range / this.height) * y) - (this.range - this.max)) * -1;

            // this.overPoint = true;

            this.updateCanvas();
            this.updateEditor(this.value);
        }
    }

    onMouseUp () {
        this.drag = false;
        this.overPoint = false; // Change the look of the point within the canvas
        this.updateCanvas(); // Draw the new point
    }

    getMousePos (canvas, evt) {
        var rect = canvas.getBoundingClientRect();
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    }

    updateEditor (pos) {
        let newpos = pos.getString();
        let start = { line: this.cursor.line, ch: this.match.start };
        let end = { line: this.cursor.line, ch: this.match.end };
        this.match.end = this.match.start + newpos.length;
        editor.replaceRange(newpos, start, end);
    }

    render () {
        return (
            <Modal id='modal-test' dialogComponentClass={DraggableModal} enforceFocus={false} className='widget-modal' show={this.state.displayPicker} onHide={this.handleClick}>
                <div className='drag'>
                    <Button onClick={ this.handleClick } className='widget-exit'><Icon type={'bt-times'} /></Button>
                </div>
                {/* The actual widget link */}
                <canvas ref='canvas' width={this.width} height={this.height} onMouseDown={this.onMouseDown} onMouseMove={this.onMouseMove} onMouseUp={this.onMouseUp}/>
            </Modal>
        );
    }
}

/**
 * Prop validation required by React
 */
WidgetLinkVec2.propTypes = {
    display: React.PropTypes.bool,
    cursor: React.PropTypes.object,
    match: React.PropTypes.object
};
