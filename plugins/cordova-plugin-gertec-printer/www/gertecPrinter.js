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
   * Imprime o cupom inteiro em um único lote (recomendado — evita corrida
   * entre linhas concorrentes e garante que o corte só acontece depois
   * que tudo foi realmente impresso).
   * @param {Object} opts { lines: [{text, align, bold, fontSize, ...}], feedLines, cut, cutMode }
   */
  printReceipt: function (opts, success, error) {
    exec(success, error, PLUGIN_NAME, 'printReceipt', [opts]);
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

  /**
   * @param {Object} opts { cut: boolean, cutMode: 'semi'|'full', feedLines: number }
   */
  finishTransaction: function (opts, success, error) {
    exec(success, error, PLUGIN_NAME, 'finishTransaction', [opts]);
  },
};

module.exports = GertecPrinter;
