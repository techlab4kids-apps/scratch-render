const twgl = require('twgl.js');

const TextWrapper = require('./util/text-wrapper');
const CanvasMeasurementProvider = require('./util/canvas-measurement-provider');
const Skin = require('./Skin');

const BubbleStyle = {
    MAX_LINE_WIDTH: 600, // Maximum width, in Scratch pixels, of a single line of text

    MIN_WIDTH: 50, // Minimum width, in Scratch pixels, of a text bubble
    STROKE_WIDTH: 4, // Thickness of the stroke around the bubble. Only half's visible because it's drawn under the fill
    PADDING: 10, // Padding around the text area
    CORNER_RADIUS: 16, // Radius of the rounded corners
    TAIL_HEIGHT: 12, // Height of the speech bubble's "tail". Probably should be a constant.

    FONT: 'Helvetica', // Font to render the text with
    // FONT_SIZE: 14, // Font size, in Scratch pixels
    FONT_HEIGHT_RATIO: 0.9, // Height, in Scratch pixels, of the text, as a proportion of the font's size
    // LINE_HEIGHT: 16, // Spacing between each line of text

    COLORS: {
        BUBBLE_FILL: 'white',
        BUBBLE_STROKE: 'rgba(0, 0, 0, 0.15)',
        TEXT_FILL: '#575E75'
    }
};

class TextSkin extends Skin {
    /**
     * Create a new text bubble skin.
     * @param {!int} id - The ID for this Skin.
     * @param {!RenderWebGL} renderer - The renderer which will use this skin.
     * @constructor
     * @extends Skin
     */
    constructor (id, renderer) {
        super(id);

        /** @type {RenderWebGL} */
        this._renderer = renderer;

        /** @type {HTMLCanvasElement} */
        this._canvas = document.createElement('canvas');

        /** @type {WebGLTexture} */
        this._texture = null;

        /** @type {Array<number>} */
        this._size = [0, 0];

        /** @type {number} */
        this._renderedScale = 0;

        /** @type {Array<string>} */
        this._lines = [];

        /** @type {Array<int>} */
        this._color = [];

        this._fontSize = 14;

        this._textSize = {width: 0, height: 0};
        this._textAreaSize = {width: 0, height: 0};

        /** @type {string} */
        this._bubbleType = '';

        /** @type {boolean} */
        this._pointsLeft = false;

        /** @type {boolean} */
        this._textDirty = true;

        /** @type {boolean} */
        this._textureDirty = true;

        this.measurementProvider = new CanvasMeasurementProvider(this._canvas.getContext('2d'));
        this.textWrapper = new TextWrapper(this.measurementProvider);

        this._restyleCanvas();
    }

    /**
     * Dispose of this object. Do not use it after calling this method.
     */
    dispose () {
        if (this._texture) {
            this._renderer.gl.deleteTexture(this._texture);
            this._texture = null;
        }
        this._canvas = null;
        super.dispose();
    }

    /**
     * @return {Array<number>} the dimensions, in Scratch units, of this skin.
     */
    get size () {
        if (this._textDirty) {
            this._reflowLines();
        }
        return this._size;
    }

    _getLineHeigth() {
        let lineHeigth = Math.round(this._fontSize/7 + this._fontSize);

        return lineHeigth;
    }

    _getFont(){
    
    }


    /**
     * Set parameters for this text bubble.
     * @param {!string} text - the text for the bubble.
     */
    setText (text) {
        this._text = text;

        this._textDirty = true;
        this._textureDirty = true;
        this.emit(Skin.Events.WasAltered);
    }

        /**
     * Set parameters for this text bubble.
     * @param {!string} text - the text for the bubble.
     */
    setColor (color) {
        this._color = color;

        this._textDirty = true;
        this._textureDirty = true;
        this.emit(Skin.Events.WasAltered);
    }

    setFontSize (fontSize) {
        this._fontSize = fontSize;

        this._textDirty = true;
        this._textureDirty = true;
        this.emit(Skin.Events.WasAltered);
    }

    setFont (font) {
        this._font = font;

        this._textDirty = true;
        this._textureDirty = true;
        this.emit(Skin.Events.WasAltered);
    }

    /**
     * Re-style the canvas after resizing it. This is necessary to ensure proper text measurement.
     */
    _restyleCanvas () {
        this._canvas.getContext('2d').font = `${this._fontSize}px ${this._font}, sans-serif`;
    }

    /**
     * Update the array of wrapped lines and the text dimensions.
     */
    _reflowLines () {
        this._restyleCanvas ()
        this._lines = this.textWrapper.wrapText(BubbleStyle.MAX_LINE_WIDTH, this._text);
        // this._lines = this.textWrapper.wrapText(this._textSize.width, this._text);

        // Measure width of longest line to avoid extra-wide bubbles
        let longestLine = 0;
        for (const line of this._lines) {
            longestLine = Math.max(longestLine, this.measurementProvider.measureText(line));
        }

        this._textSize.width = longestLine;
        this._textSize.height = this._getLineHeigth() * this._lines.length;

        // Calculate the canvas-space sizes of the padded text area and full text bubble
        const paddedWidth = Math.max(this._textSize.width, BubbleStyle.MIN_WIDTH) + (BubbleStyle.PADDING * 2);
        const paddedHeight = this._textSize.height + (BubbleStyle.PADDING * 2);

        this._textAreaSize.width = paddedWidth;
        this._textAreaSize.height = paddedHeight;

        this._size[0] = paddedWidth + BubbleStyle.STROKE_WIDTH;
        this._size[1] = paddedHeight + BubbleStyle.STROKE_WIDTH + BubbleStyle.TAIL_HEIGHT;

        this._textDirty = false;
    }

    /**
     * Render this text bubble at a certain scale, using the current parameters, to the canvas.
     * @param {number} scale The scale to render the bubble at
     */
    _renderTextBubble (scale) {
        const ctx = this._canvas.getContext('2d');

        if (this._textDirty) {
            this._reflowLines();
        }

        // Resize the canvas to the correct screen-space size
        this._canvas.width = Math.ceil(this._size[0] * scale);
        this._canvas.height = Math.ceil(this._size[1] * scale);
        this._restyleCanvas();

        // Reset the transform before clearing to ensure 100% clearage
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

        ctx.scale(scale, scale);
        ctx.translate(BubbleStyle.STROKE_WIDTH * 0.5, BubbleStyle.STROKE_WIDTH * 0.5);

        // If the text bubble points leftward, flip the canvas
        ctx.save();
        
        ctx.stroke();
        ctx.fill();

        // Un-flip the canvas if it was flipped
        ctx.restore();

        // Draw each line of text
        // ctx.fillStyle = BubbleStyle.COLORS.TEXT_FILL;
        ctx.fillStyle = this._color; //'rgba(0, 0, 0, 1)';
        ctx.font = `${this._fontSize}px ${this._font}, sans-serif`;
        const lines = this._lines;
        for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
            const line = lines[lineNumber];
            ctx.fillText(
                line,
                BubbleStyle.PADDING,
                BubbleStyle.PADDING + (this._getLineHeigth() * lineNumber) +
                    (BubbleStyle.FONT_HEIGHT_RATIO * this._fontSize)
            );
        }

        this._renderedScale = scale;
    }

    /**
     * @param {Array<number>} scale - The scaling factors to be used, each in the [0,100] range.
     * @return {WebGLTexture} The GL texture representation of this skin when drawing at the given scale.
     */
    getTexture (scale) {
        // The texture only ever gets uniform scale. Take the larger of the two axes.
        const scaleMax = scale ? Math.max(Math.abs(scale[0]), Math.abs(scale[1])) : 100;
        const requestedScale = scaleMax / 100;

        // If we already rendered the text bubble at this scale, we can skip re-rendering it.
        if (this._textureDirty || this._renderedScale !== requestedScale) {
            this._renderTextBubble(requestedScale);
            this._textureDirty = false;

            const context = this._canvas.getContext('2d');
            const textureData = context.getImageData(0, 0, this._canvas.width, this._canvas.height);

            const gl = this._renderer.gl;

            if (this._texture === null) {
                const textureOptions = {
                    auto: true,
                    wrap: gl.CLAMP_TO_EDGE,
                    src: textureData
                };

                this._texture = twgl.createTexture(gl, textureOptions);
            }
    
            gl.bindTexture(gl.TEXTURE_2D, this._texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureData);
            this._silhouette.update(textureData);
        }

        return this._texture;
    }
}

module.exports = TextSkin;
