fabric.util.object.extend(fabric.IText.prototype, /** @lends fabric.IText.prototype */ {
  /**
   * Initializes "dbclick" event handler
   */
  initDoubleClickSimulation: function() {

    // for double click
    this.__lastClickTime = +new Date();

    // for triple click
    this.__lastLastClickTime = +new Date();

    this.lastPointer = { };

    this.on('mousedown', this.onMouseDown.bind(this));
  },

  onMouseDown: function(options) {

    this.__newClickTime = +new Date();
    var newPointer = this.canvas.getPointer(options.e);

    if (this.isTripleClick(newPointer)) {
      this.fire('tripleclick', options);
      this._stopEvent(options.e);
    }
    else if (this.isDoubleClick(newPointer)) {
      this.fire('dblclick', options);
      this._stopEvent(options.e);
    }

    this.__lastLastClickTime = this.__lastClickTime;
    this.__lastClickTime = this.__newClickTime;
    this.__lastPointer = newPointer;
  },

  isDoubleClick: function(newPointer) {
    return this.__newClickTime - this.__lastClickTime < 500 &&
        this.__lastPointer.x === newPointer.x &&
        this.__lastPointer.y === newPointer.y;
  },

  isTripleClick: function(newPointer) {
    return this.__newClickTime - this.__lastClickTime < 500 &&
        this.__lastClickTime - this.__lastLastClickTime < 500 &&
        this.__lastPointer.x === newPointer.x &&
        this.__lastPointer.y === newPointer.y;
  },

  /**
   * @private
   */
  _stopEvent: function(e) {
    e.preventDefault && e.preventDefault();
    e.stopPropagation && e.stopPropagation();
  },

  /**
   * Initializes event handlers related to cursor or selection
   */
  initCursorSelectionHandlers: function() {
    this.initSelectedHandler();
    this.initMousedownHandler();
    this.initMousemoveHandler();
    this.initMouseupHandler();
    this.initClicks();
  },

  /**
   * Initializes double and triple click event handlers
   */
  initClicks: function() {
    this.on('dblclick', function(options) {
      this.selectWord(this.getSelectionStartFromPointer(options.e));
    });
    this.on('tripleclick', function(options) {
      this.selectLine(this.getSelectionStartFromPointer(options.e));
    });
  },

  /**
   * Initializes "mousedown" event handler
   */
  initMousedownHandler: function() {
    this.on('mousedown', function(options) {

      var pointer = this.canvas.getPointer(options.e);

      this.__mousedownX = pointer.x;
      this.__mousedownY = pointer.y;
      this.__isMousedown = true;

      if (this.hiddenTextarea && this.canvas) {
        this.canvas.wrapperEl.appendChild(this.hiddenTextarea);
      }

      if (this.isEditing) {
        this.setCursorByClick(options.e);
        this.__selectionStartOnMouseDown = this.selectionStart;
      }

    });
  },

  /**
   * Initializes "mousemove" event handler
   */
  initMousemoveHandler: function() {
    this.on('mousemove', function(options) {
      if (!this.__isMousedown || !this.isEditing) return;

      var newSelectionStart = this.getSelectionStartFromPointer(options.e);

      if (newSelectionStart >= this.__selectionStartOnMouseDown) {
        this.setSelectionStart(this.__selectionStartOnMouseDown);
        this.setSelectionEnd(newSelectionStart);
      }
      else {
        this.setSelectionStart(newSelectionStart);
        this.setSelectionEnd(this.__selectionStartOnMouseDown);
      }
    });
  },

  /**
   * @private
   */
  _isObjectMoved: function(e) {
    var pointer = this.canvas.getPointer(e);

    return this.__mousedownX !== pointer.x ||
           this.__mousedownY !== pointer.y;
  },

  /**
   * Initializes "mouseup" event handler
   */
  initMouseupHandler: function() {
    this.on('mouseup', function(options) {
      this.__isMousedown = false;

      if (this._isObjectMoved(options.e)) return;

      if (this.selected) {
        this.enterEditing();
      }
    });
  },

  /**
   * Changes cursor location in a text depending on passed pointer (x/y) object
   * @param {Object} pointer Pointer object with x and y numeric properties
   */
  setCursorByClick: function(e) {
    var newSelectionStart = this.getSelectionStartFromPointer(e);

    if (e.shiftKey) {
      if (newSelectionStart < this.selectionStart) {
        this.setSelectionEnd(this.selectionStart);
        this.setSelectionStart(newSelectionStart);
      }
      else {
        this.setSelectionEnd(newSelectionStart);
      }
    }
    else {
      this.setSelectionStart(newSelectionStart);
      this.setSelectionEnd(newSelectionStart);
    }
  },

  /**
   * @private
   * @param {Event} e Event object
   * @param {Object} Object with x/y corresponding to local offset (according to object rotation)
   */
  _getLocalRotatedPointer: function(e) {
    var pointer = this.canvas.getPointer(e),

        pClicked = new fabric.Point(pointer.x, pointer.y),
        pLeftTop = new fabric.Point(this.left, this.top),

        rotated = fabric.util.rotatePoint(
          pClicked, pLeftTop, fabric.util.degreesToRadians(-this.angle));

    return this.getLocalPointer(e, rotated);
  },

  /**
   * Returns index of a character corresponding to where an object was clicked
   * @param {Event} e Event object
   * @return {Number} Index of a character
   */
  getSelectionStartFromPointer: function(e) {

    var mouseOffset = this._getLocalRotatedPointer(e),
        textLines = this.text.split(this._reNewline),
        prevWidth = 0,
        width = 0,
        height = 0,
        charIndex = 0,
        newSelectionStart;

    for (var i = 0, len = textLines.length; i < len; i++) {

      height += this._getHeightOfLine(this.ctx, i) * this.scaleY;

      var widthOfLine = this._getWidthOfLine(this.ctx, i, textLines);
      var lineLeftOffset = this._getLineLeftOffset(widthOfLine);

      width = lineLeftOffset;

      if (this.flipX) {
        // when oject is horizontally flipped we reverse chars
        textLines[i] = textLines[i].split('').reverse().join('');
      }

      for (var j = 0, jlen = textLines[i].length; j < jlen; j++) {

        var _char = textLines[i][j];
        prevWidth = width;

        width += this._getWidthOfChar(this.ctx, _char, i, this.flipX ? jlen - j : j) *
                 this.scaleX;

        if (height <= mouseOffset.y || width <= mouseOffset.x) {
          charIndex++;
          continue;
        }

        return this._getNewSelectionStartFromOffset(
          mouseOffset, prevWidth, width, charIndex + i, jlen);
      }
    }

    // clicked somewhere after all chars, so set at the end
    if (typeof newSelectionStart === 'undefined') {
      return this.text.length;
    }
  },

  /**
   * @private
   */
  _getNewSelectionStartFromOffset: function(mouseOffset, prevWidth, width, index, jlen) {

    var distanceBtwLastCharAndCursor = mouseOffset.x - prevWidth,
        distanceBtwNextCharAndCursor = width - mouseOffset.x,
        offset = distanceBtwNextCharAndCursor > distanceBtwLastCharAndCursor ? 0 : 1,
        newSelectionStart = index + offset;

    // if object is horizontally flipped, mirror cursor location from the end
    if (this.flipX) {
      newSelectionStart = jlen - newSelectionStart;
    }

    if (newSelectionStart > this.text.length) {
      newSelectionStart = this.text.length;
    }

    return newSelectionStart;
  }
});