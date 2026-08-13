var exec = require('cordova/exec');

var PLUGIN_NAME = 'GertecPrinterPlugin';

var GertecPrinter = {
  /**
   * @param {Object} opts { text, fontSize, bold, underline, align, wordwrap, letterSpacing, marginLeft, lineHeight }
   */
  printText: function (opts, success, error) {
    exec(success, error, PLUGIN_NAME, 'printText', [opts]);
  },

  /**
   * @param {Object} opts { text, width, height }
   */
  printQRCode: function (opts, success, error) {
    exec(success, error, PLUGIN_NAME, 'printQRCode', [opts]);
  },

  /**
   * @param {Object} opts { text, width, height, align }
   */
  printBarCode: function (opts, success, error) {
    exec(success, error, PLUGIN_NAME, 'printBarCode', [opts]);
  },

  wrapLine: function (times, success, error) {
    exec(success, error, PLUGIN_NAME, 'wrapLine', [times]);
  },

  cutPaper: function (fullCut, success, error) {
    exec(success, error, PLUGIN_NAME, 'cutPaper', [fullCut]);
  },

  getPrinterState: function (success, error) {
    exec(success, error, PLUGIN_NAME, 'getPrinterState', []);
  },

  startTransaction: function (success, error) {
    exec(success, error, PLUGIN_NAME, 'startTransaction', []);
  },

  finishTransaction: function (canCut, success, error) {
    exec(success, error, PLUGIN_NAME, 'finishTransaction', [canCut]);
  },
};

module.exports = GertecPrinter;
