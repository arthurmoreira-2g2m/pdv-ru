package br.com.x4studio.gertecprinter;

import android.content.Context;
import android.os.RemoteException;
import android.util.Log;

import com.topwise.cloudpos.aidl.printer.AidlPrinter;
import com.topwise.cloudpos.aidl.printer.AidlPrinterListener;
import com.topwise.cloudpos.aidl.printer.PrintCuttingMode;
import com.topwise.cloudpos.aidl.printer.PrintItemObj;
import com.topwise.cloudpos.data.PrinterConstant;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.PluginResult;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

/**
 * Cordova plugin bridging the app's JS layer (window.GertecPrinter) to the
 * real Topwise CloudPOS AIDL SDK used internally by Gertec SK210 terminals.
 *
 * This is NOT a guess: the AIDL package names, method signatures and the
 * service-binding approach below were extracted directly from the
 * open-source "gertec" Flutter plugin (github.com/brasizza/gertec),
 * whose README explicitly states it was tested on a Gertec SK-210 — the
 * same model used in this project. The underlying .jar (TOPSDK) is bundled
 * with this plugin in /libs.
 *
 * TODO quando o cadastro no Portal do Desenvolvedor Gertec
 * (developer.gertec.com.br) for aprovado: comparar esta implementação com
 * a documentação/SDK oficial e ajustar se houver qualquer divergência de
 * versão. Esta implementação é um caminho pragmático enquanto isso não
 * chega, não um substituto definitivo da fonte oficial.
 */
public class GertecPrinterPlugin extends CordovaPlugin {

    private static final String TAG = "GertecPrinterPlugin";

    private static final String DEVICE_SERVICE_PACKAGE_NAME = "com.android.topwise.topusdkservice";
    private static final String DEVICE_SERVICE_CLASS_NAME = "com.android.topwise.topusdkservice.service.DeviceService";
    private static final String ACTION_DEVICE_SERVICE = "topwise_cloudpos_device_service";

    private Object mDeviceService; // com.topwise.cloudpos.aidl.AidlDeviceService, resolvido via reflection
    private AidlPrinter printer;
    private boolean isBound = false;

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        try {
            ensurePrinter();
        } catch (Exception e) {
            Log.e(TAG, "Falha ao obter instância da impressora Gertec/Topwise", e);
            callbackContext.error("Impressora indisponível: " + e.getMessage());
            return true;
        }

        if (printer == null) {
            callbackContext.error("Serviço da impressora Gertec (Topwise) não encontrado neste dispositivo.");
            return true;
        }

        switch (action) {
            case "printText":
                return handlePrintText(args, callbackContext);
            case "printReceipt":
                return handlePrintReceipt(args, callbackContext);
            case "printQRCode":
                return handlePrintQRCode(args, callbackContext);
            case "printBarCode":
                return handlePrintBarCode(args, callbackContext);
            case "wrapLine":
                return handleWrapLine(args, callbackContext);
            case "cutPaper":
                return handleCutPaper(args, callbackContext);
            case "getPrinterState":
                return handleGetPrinterState(callbackContext);
            case "startTransaction":
                return handleStartTransaction(callbackContext);
            case "finishTransaction":
                return handleFinishTransaction(args, callbackContext);
            default:
                return false;
        }
    }

    // ---------------------------------------------------------------
    // Conexão com o serviço AIDL do sistema (Topwise/Gertec)
    // ---------------------------------------------------------------

    private void ensurePrinter() throws Exception {
        if (printer != null) {
            return;
        }
        Context context = cordova.getActivity().getApplicationContext();

        Object binder = getSystemServiceBinder(context, ACTION_DEVICE_SERVICE);
        if (binder == null) {
            throw new IllegalStateException(
                "Serviço de sistema 'topwise_cloudpos_device_service' não encontrado. " +
                "Este dispositivo pode não ser um totem Gertec/Topwise, ou o serviço do fabricante não está ativo."
            );
        }

        Class<?> aidlDeviceServiceClass = Class.forName("com.topwise.cloudpos.aidl.AidlDeviceService");
        Class<?> stubClass = Class.forName("com.topwise.cloudpos.aidl.AidlDeviceService$Stub");
        Method asInterface = stubClass.getMethod("asInterface", android.os.IBinder.class);
        mDeviceService = asInterface.invoke(null, (android.os.IBinder) binder);

        if (mDeviceService == null) {
            throw new IllegalStateException("Não foi possível vincular ao AidlDeviceService.");
        }

        Method getPrinterMethod = aidlDeviceServiceClass.getMethod("getPrinter");
        Object printerBinder = getPrinterMethod.invoke(mDeviceService);
        printer = AidlPrinter.Stub.asInterface((android.os.IBinder) printerBinder);
        isBound = (printer != null);
    }

    /**
     * Busca o serviço de sistema do fabricante via reflection em
     * android.os.ServiceManager, exatamente como o plugin gertec (Flutter)
     * faz — este serviço já roda como parte do sistema no totem, não
     * precisa (e não deve) ser "bindado" via Intent comum.
     */
    private Object getSystemServiceBinder(Context context, String serviceName) throws Exception {
        ClassLoader cl = context.getClassLoader();
        Class<?> serviceManager = cl.loadClass("android.os.ServiceManager");
        Method get = serviceManager.getMethod("getService", String.class);
        return get.invoke(null, serviceName);
    }

    // ---------------------------------------------------------------
    // Comandos de impressão
    // ---------------------------------------------------------------

    private final AidlPrinterListener printListener = new AidlPrinterListener.Stub() {
        @Override
        public void onError(int i) throws RemoteException {
            Log.d(TAG, "onError: " + i);
        }

        @Override
        public void onPrintFinish() throws RemoteException {
            Log.d(TAG, "onPrintFinish");
        }
    };

    private boolean handlePrintText(JSONArray args, CallbackContext callbackContext) {
        try {
            JSONObject opts = args.optJSONObject(0);
            String text = opts != null ? opts.optString("text", "") : args.optString(0, "");

            List<PrintItemObj> items = new ArrayList<>();
            items.add(buildPrintItem(text, opts));

            printer.addRuiText(items);
            printer.printRuiQueue(printListener);

            callbackContext.success();
        } catch (Exception e) {
            Log.e(TAG, "Erro em printText", e);
            callbackContext.error("Erro ao imprimir texto: " + e.getMessage());
        }
        return true;
    }

    /**
     * Constrói um PrintItemObj a partir de um JSONObject de opções vindo do JS.
     * Compartilhado entre printText (linha única) e printReceipt (lote).
     */
    private PrintItemObj buildPrintItem(String text, JSONObject opts) {
        int fontSize = opts != null ? opts.optInt("fontSize", PrinterConstant.FontSize.NORMAL) : PrinterConstant.FontSize.NORMAL;
        boolean bold = opts != null && opts.optBoolean("bold", false);
        boolean underline = opts != null && opts.optBoolean("underline", false);
        boolean wordWrap = opts == null || opts.optBoolean("wordwrap", true);
        int align = opts != null ? opts.optInt("align", 0) : 0; // 0=LEFT, 1=CENTER, 2=RIGHT
        int letterSpacing = opts != null ? opts.optInt("letterSpacing", 0) : 0;
        int marginLeft = opts != null ? opts.optInt("marginLeft", 0) : 0;
        int lineHeight = opts != null ? opts.optInt("lineHeight", 29) : 29;

        PrintItemObj item = new PrintItemObj(text);
        item.setLetterSpacing(letterSpacing);
        item.setLineHeight(lineHeight);
        item.setMarginLeft(marginLeft);
        item.setBold(bold);
        item.setUnderline(underline);
        item.setFontSize(fontSize);
        item.setWordWrap(wordWrap);

        PrintItemObj.ALIGN alignEnum = PrintItemObj.ALIGN.LEFT;
        if (align == 1) alignEnum = PrintItemObj.ALIGN.CENTER;
        if (align == 2) alignEnum = PrintItemObj.ALIGN.RIGHT;
        item.setAlign(alignEnum);

        return item;
    }

    /**
     * Imprime o cupom inteiro em UM ÚNICO lote (uma chamada addRuiText com
     * todas as linhas + UMA chamada printRuiQueue), ao invés de uma
     * chamada separada por linha. Isso evita a condição de corrida em que
     * várias filas de impressão concorrentes (uma por linha) deixavam o
     * corte da guilhotina disparar fora de ordem / antes do papel todo
     * ter sido efetivamente impresso.
     *
     * args[0] = { lines: [ {text, align, bold, fontSize, ...}, ... ],
     *             feedLines: number, cut: boolean, cutMode: 'semi'|'full' }
     */
    private boolean handlePrintReceipt(JSONArray args, CallbackContext callbackContext) {
        try {
            JSONObject opts = args.optJSONObject(0);
            if (opts == null) {
                callbackContext.error("printReceipt requer um objeto de opções com 'lines'.");
                return true;
            }

            JSONArray linesJson = opts.optJSONArray("lines");
            final boolean canCut = opts.optBoolean("cut", true);
            final boolean semiCorte = !"full".equalsIgnoreCase(opts.optString("cutMode", "full"));
            final int feedLines = opts.optInt("feedLines", 14);

            List<PrintItemObj> items = new ArrayList<>();
            if (linesJson != null) {
                for (int i = 0; i < linesJson.length(); i++) {
                    JSONObject lineOpts = linesJson.getJSONObject(i);
                    String text = lineOpts.optString("text", "");
                    items.add(buildPrintItem(text, lineOpts));
                }
            }

            printer.addRuiText(items);
            printer.printRuiQueue(new AidlPrinterListener.Stub() {
                @Override
                public void onError(int i) throws RemoteException {
                    Log.d(TAG, "onError (printReceipt): " + i);
                }

                @Override
                public void onPrintFinish() throws RemoteException {
                    try {
                        // Só avança papel + corta DEPOIS que o SDK confirma que
                        // todo o lote de texto acima já foi de fato impresso.
                        List<PrintItemObj> feedItems = new ArrayList<>();
                        PrintItemObj blank = new PrintItemObj("");
                        blank.setFontSize(0);
                        blank.setLineHeight(29);
                        for (int i = 0; i < feedLines; i++) {
                            feedItems.add(blank);
                        }
                        printer.addRuiText(feedItems);
                        printer.printRuiQueue(null);

                        if (canCut) {
                            int result = printer.cuttingPaper(
                                semiCorte ? PrintCuttingMode.CUTTING_MODE_HALT : PrintCuttingMode.CUTTING_MODE_FULL
                            );
                            Log.d(TAG, "cuttingPaper() resultado: " + result);
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Erro ao finalizar impressão em lote (feed/corte)", e);
                    }
                }
            });

            callbackContext.success();
        } catch (Exception e) {
            Log.e(TAG, "Erro em printReceipt", e);
            callbackContext.error("Erro ao imprimir cupom em lote: " + e.getMessage());
        }
        return true;
    }

    private boolean handlePrintQRCode(JSONArray args, CallbackContext callbackContext) {
        try {
            JSONObject opts = args.optJSONObject(0);
            String text = opts != null ? opts.optString("text", "") : "";
            int width = opts != null ? opts.optInt("width", 200) : 200;
            int height = opts != null ? opts.optInt("height", 200) : 200;

            printer.addRuiQRCode(text, width, height);
            printer.printRuiQueue(printListener);

            callbackContext.success();
        } catch (Exception e) {
            Log.e(TAG, "Erro em printQRCode", e);
            callbackContext.error("Erro ao imprimir QR Code: " + e.getMessage());
        }
        return true;
    }

    private boolean handlePrintBarCode(JSONArray args, CallbackContext callbackContext) {
        try {
            JSONObject opts = args.optJSONObject(0);
            String text = opts != null ? opts.optString("text", "") : "";
            int width = opts != null ? opts.optInt("width", 300) : 300;
            int height = opts != null ? opts.optInt("height", 80) : 80;
            int align = opts != null ? opts.optInt("align", 1) : 1;

            printer.addRuiBarCode(text, width, height, align);
            printer.printRuiQueue(printListener);

            callbackContext.success();
        } catch (Exception e) {
            Log.e(TAG, "Erro em printBarCode", e);
            callbackContext.error("Erro ao imprimir código de barras: " + e.getMessage());
        }
        return true;
    }

    private boolean handleWrapLine(JSONArray args, CallbackContext callbackContext) {
        try {
            int times = args.length() > 0 ? args.optInt(0, 1) : 1;
            List<PrintItemObj> items = new ArrayList<>();
            PrintItemObj blank = new PrintItemObj("");
            blank.setLetterSpacing(0);
            blank.setLineHeight(0);
            blank.setMarginLeft(0);
            blank.setBold(false);
            blank.setUnderline(false);
            blank.setFontSize(0);
            blank.setWordWrap(false);
            for (int i = 0; i < times; i++) {
                items.add(blank);
            }
            printer.addRuiText(items);
            printer.printRuiQueue(printListener);
            callbackContext.success();
        } catch (Exception e) {
            Log.e(TAG, "Erro em wrapLine", e);
            callbackContext.error("Erro ao avançar papel: " + e.getMessage());
        }
        return true;
    }

    private boolean handleCutPaper(JSONArray args, CallbackContext callbackContext) {
        try {
            boolean fullCut = args.length() == 0 || args.optBoolean(0, true);
            int result = printer.cuttingPaper(
                fullCut ? PrintCuttingMode.CUTTING_MODE_FULL : PrintCuttingMode.CUTTING_MODE_HALT
            );
            callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.OK, result));
        } catch (Exception e) {
            Log.e(TAG, "Erro em cutPaper", e);
            callbackContext.error("Erro ao cortar papel: " + e.getMessage());
        }
        return true;
    }

    private boolean handleGetPrinterState(CallbackContext callbackContext) {
        try {
            int state = printer.getPrinterState();
            callbackContext.sendPluginResult(new PluginResult(PluginResult.Status.OK, state));
        } catch (Exception e) {
            Log.e(TAG, "Erro em getPrinterState", e);
            callbackContext.error("Erro ao obter status da impressora: " + e.getMessage());
        }
        return true;
    }

    private boolean handleStartTransaction(CallbackContext callbackContext) {
        try {
            printer.resetQueue();
            callbackContext.success();
        } catch (Exception e) {
            Log.e(TAG, "Erro em startTransaction", e);
            callbackContext.error("Erro ao iniciar transação de impressão: " + e.getMessage());
        }
        return true;
    }

    private boolean handleFinishTransaction(JSONArray args, CallbackContext callbackContext) {
        try {
            JSONObject opts = args.optJSONObject(0);
            final boolean canCut = opts == null || opts.optBoolean("cut", true);
            final boolean semiCorte = opts == null || !"full".equalsIgnoreCase(opts.optString("cutMode", "semi"));
            // Cada linha em branco com lineHeight ~29 avança aproximadamente
            // 3,5-4mm no SK210 (calibrado empiricamente). 6 linhas ≈ 1cm de
            // folga antes do corte, para não cortar em cima do texto.
            final int feedLines = opts != null ? opts.optInt("feedLines", 6) : 6;

            printer.printRuiQueue(new AidlPrinterListener.Stub() {
                @Override
                public void onError(int i) throws RemoteException {
                    Log.d(TAG, "onError: " + i);
                }

                @Override
                public void onPrintFinish() throws RemoteException {
                    try {
                        // Avanço de papel (folga) antes do corte, para não cortar em cima do texto
                        List<PrintItemObj> items = new ArrayList<>();
                        PrintItemObj blank = new PrintItemObj("");
                        blank.setFontSize(0);
                        blank.setLineHeight(29);
                        for (int i = 0; i < feedLines; i++) {
                            items.add(blank);
                        }
                        printer.addRuiText(items);
                        printer.printRuiQueue(null);
                        if (canCut) {
                            // Corte semiautomático (parcial) por padrão: menos estresse
                            // mecânico na guilhotina e reduz risco de atolamento/corte
                            // em cima da informação. Corte total só se explicitamente pedido.
                            printer.cuttingPaper(
                                semiCorte ? PrintCuttingMode.CUTTING_MODE_HALT : PrintCuttingMode.CUTTING_MODE_FULL
                            );
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Erro ao finalizar transação de impressão", e);
                    }
                }
            });
            callbackContext.success();
        } catch (Exception e) {
            Log.e(TAG, "Erro em finishTransaction", e);
            callbackContext.error("Erro ao finalizar impressão: " + e.getMessage());
        }
        return true;
    }
}
