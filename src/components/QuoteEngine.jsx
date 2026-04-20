import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Download, Truck, Plus, Eye, Trash2, ArrowRight, Check, ChevronDown, Search, Calendar, FileText, MessageCircle, Upload, DollarSign, Filter, Bell, Save, Star, Pencil, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COBRANZA_PHONE = '56912345678'; // NÚMERO DE COBRANZA (DEFINIDO)

// --- Helper for input fields in the create form ---
const InputField = ({ label, value, onChange, type = "text", placeholder = "", onFocus, onBlur }) => (
    <div className="flex flex-col gap-1.5 relative">
        <label className="label-field">{label}</label>
        <input
            type={type}
            value={value}
            onChange={onChange}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder}
            className="input-field"
        />
    </div>
);

const calculateSubtotal = (quote) => {
    let subtotal = 0;
    if (!quote || !quote.items) return 0;
    Object.values(quote.items).forEach(category => {
        if (Array.isArray(category)) {
            category.forEach(item => {
                subtotal += item.total || 0;
            });
        }
    });
    return subtotal;
};

const calculateTotal = (quote) => {
    const subtotal = calculateSubtotal(quote);
    let total = subtotal;

    // Apply discount if exists
    if (quote.discountPercentage && quote.discountPercentage > 0) {
        total = subtotal * (1 - (quote.discountPercentage / 100));
    }

    return Math.round(total);
};

const calculateGlobalTotal = (quote) => {
    const total = calculateTotal(quote);
    return Math.round(total * 1.19);
};

// Strips year from date strings like "DD/MM/YYYY HH:MM" → "DD/MM HH:MM"
const formatDateNoYear = (dateStr) => {
    if (!dateStr) return '';
    return dateStr.replace(/\/\d{4}/, '');
};

// Formats date strings to include day of week in Spanish: "Jue 05/03 a las 11:00"
const formatDateWithDay = (dateStr) => {
    if (!dateStr) return '';

    // Improved time normalization
    const normalizeTime = (timePart) => {
        if (!timePart) return '';
        let clean = timePart.toLowerCase().replace(/a las/g, '').trim();

        // HH:MM or H:MM
        const hmMatch = clean.match(/^(\d{1,2}):(\d{2})$/);
        if (hmMatch) return `${hmMatch[1].padStart(2, '0')}:${hmMatch[2]}`;

        // HHam/pm or Ham/pm (10am, 10 am, 10pm)
        const ampmMatch = clean.match(/^(\d{1,2})\s*(am|pm)$/);
        if (ampmMatch) {
            let hour = parseInt(ampmMatch[1]);
            const period = ampmMatch[2];
            if (period === 'pm' && hour < 12) hour += 12;
            if (period === 'am' && hour === 12) hour = 0;
            return `${hour.toString().padStart(2, '0')}:00`;
        }

        // Plain HH (10, 13, 8)
        const hMatch = clean.match(/^(\d{1,2})$/);
        if (hMatch) {
            let hour = parseInt(hMatch[1]);
            if (hour >= 0 && hour <= 23) {
                return `${hour.toString().padStart(2, '0')}:00`;
            }
        }

        return timePart; // Fallback
    };

    let d, m, y, timePart = '';

    // Try to parse ISO YYYY-MM-DD
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}:\d{2}))?/);
    if (isoMatch) {
        [, y, m, d, timePart] = isoMatch;
    } else {
        // Try to parse DD/MM HH:MM or DD/MM/YYYY HH:MM or with AM/PM
        // Also supports day name prefix: "Lun 05/03"
        const cleanStr = dateStr.replace(/^[A-Z][a-z]{2,3}\s+/, '');
        const parts = cleanStr.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?(?:\s+(.*))?/);
        if (!parts) return dateStr;
        [, d, m, y, timePart] = parts;
    }

    const year = y || new Date().getFullYear();
    const date = new Date(parseInt(year), parseInt(m) - 1, parseInt(d));
    if (isNaN(date.getTime())) return dateStr;

    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const dayName = days[date.getDay()];

    const normalizedTime = normalizeTime(timePart);

    let result = `${dayName} ${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}/${year}`;
    if (normalizedTime) {
        result += ` a las ${normalizedTime}`;
    }
    return result;
};

// --- Stable Sub-components defined outside to prevent focus reset ---

const RenderPuntoUrbanoModel = ({
    quote,
    showPrices = true,
    logisticsNote,
    setLogisticsNote,
    handleSaveLogisticsNote,
    handleFileUpload,
    handleDeleteVoucher
}) => (
    <div className="punto-urbano-quote">
        <div className="quote-header">
            <div className="client-data text-left">
                <p><strong>CLIENTE:</strong> {quote.client}</p>
                <p><strong>EVENTO:</strong> {quote.eventName || 'N/A'}</p>
                <p><strong>LOCACIÓN:</strong> {quote.location}</p>
                <p><strong>MONTAJE:</strong> {formatDateWithDay(quote.timing?.montaje)}</p>
                <p><strong>FECHA:</strong> {formatDateWithDay(quote.timing?.event_date_full || quote.eventDate || quote.event_date)}</p>
                <p><strong>DESMONTAJE:</strong> {formatDateWithDay(quote.timing?.desmontaje)}</p>
                {quote.timing?.contactPhone && <p><strong>TELÉFONO:</strong> {quote.timing.contactPhone}</p>}
            </div>
            <div className="brand-data flex flex-col items-end justify-start">
                <div className="w-[50px] h-auto flex justify-end overflow-hidden">
                    <img
                        src="/logo.png"
                        alt="PUNTOURBANO"
                        className="w-full h-auto object-contain"
                    />
                </div>
                <p className="quote-number text-right font-black text-slate-900 mt-4">N° PRESUPUESTO: #{quote.id}</p>
            </div>
        </div>

        <table className="quote-table">
            <thead>
                <tr>
                    <th style={{ textAlign: 'left' }}>DESCRIPCIÓN</th>
                    <th style={{ width: '80px' }}>CANT</th>
                    <th style={{ width: '80px' }}>DÍAS</th>
                    {showPrices && <><th style={{ width: '120px' }}>VALOR UNIT</th><th style={{ width: '120px' }}>NETO</th></>}
                </tr>
            </thead>
            <tbody>
                {/* LOUNGE */}
                {quote.items.lounge?.filter(item => item.name?.trim() && item.cant > 0).length > 0 && (
                    <>
                        <tr className="category-row text-left">
                            <td colSpan={showPrices ? 5 : 3} className="py-4">
                                <span className="px-3 py-1 rounded-lg text-[0.65rem] font-black uppercase tracking-wide border shadow-sm badge-lounge">
                                    LOUNGE
                                </span>
                            </td>
                        </tr>
                        {quote.items.lounge.filter(item => item.name?.trim() && item.cant > 0).map((item, i) => (
                            <tr key={`lounge-${i}`}>
                                <td className="text-left">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-slate-800">{item.name}</span>
                                        {item.observation && <span className="text-[12px] text-slate-400 italic mt-0.5">{item.observation}</span>}
                                    </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>{item.cant}</td>
                                <td style={{ textAlign: 'center' }}>{item.days}</td>
                                {showPrices && <><td style={{ textAlign: 'right' }}>${item.unit.toLocaleString()}</td><td style={{ textAlign: 'right' }}>${item.total.toLocaleString()}</td></>}
                            </tr>
                        ))}
                    </>
                )}

                {/* ACCESORIOS */}
                {quote.items.accesorios?.filter(item => item.name?.trim() && item.cant > 0).length > 0 && (
                    <>
                        <tr className="category-row text-left">
                            <td colSpan={showPrices ? 5 : 3} className="py-4">
                                <span className="px-3 py-1 rounded-lg text-[0.65rem] font-black uppercase tracking-wide border shadow-sm badge-accesorios">
                                    ACCESORIOS
                                </span>
                            </td>
                        </tr>
                        {quote.items.accesorios.filter(item => item.name?.trim() && item.cant > 0).map((item, i) => (
                            <tr key={`acc-${i}`}>
                                <td className="text-left">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-slate-800">{item.name}</span>
                                        {item.observation && <span className="text-[12px] text-slate-400 italic mt-0.5">{item.observation}</span>}
                                    </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>{item.cant}</td>
                                <td style={{ textAlign: 'center' }}>{item.days}</td>
                                {showPrices && <><td style={{ textAlign: 'right' }}>${item.unit.toLocaleString()}</td><td style={{ textAlign: 'right' }}>${item.total.toLocaleString()}</td></>}
                            </tr>
                        ))}
                    </>
                )}

                {/* DECO */}
                {quote.items.deco?.filter(item => item.name?.trim() && item.cant > 0).length > 0 && (
                    <>
                        <tr className="category-row text-left">
                            <td colSpan={showPrices ? 5 : 3} className="py-4">
                                <span className="px-3 py-1 rounded-lg text-[0.65rem] font-black uppercase tracking-wide border shadow-sm badge-deco">
                                    DECO
                                </span>
                            </td>
                        </tr>
                        {quote.items.deco.filter(item => item.name?.trim() && item.cant > 0).map((item, i) => (
                            <tr key={`deco-${i}`}>
                                <td className="text-left">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-slate-800">{item.name}</span>
                                        {item.observation && <span className="text-[12px] text-slate-400 italic mt-0.5">{item.observation}</span>}
                                    </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>{item.cant}</td>
                                <td style={{ textAlign: 'center' }}>{item.days}</td>
                                {showPrices && <><td style={{ textAlign: 'right' }}>${item.unit.toLocaleString()}</td><td style={{ textAlign: 'right' }}>${item.total.toLocaleString()}</td></>}
                            </tr>
                        ))}
                    </>
                )}

                {/* EXTRAS (Migration from 'otros') */}
                {(quote.items.extras || quote.items.otros)?.filter(item => item.name?.trim() && item.cant > 0).length > 0 && (
                    <>
                        <tr className="category-row text-left">
                            <td colSpan={showPrices ? 5 : 3} className="py-4">
                                <span className="px-3 py-1 rounded-lg text-[0.65rem] font-black uppercase tracking-wide border shadow-sm badge-extras">
                                    EXTRAS
                                </span>
                            </td>
                        </tr>
                        {(quote.items.extras || quote.items.otros).filter(item => item.name?.trim() && item.cant > 0).map((item, i) => (
                            <tr key={`extras-${i}`}>
                                <td className="text-left">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-slate-800">{item.name}</span>
                                        {item.observation && <span className="text-[12px] text-slate-400 italic mt-0.5">{item.observation}</span>}
                                    </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>{item.cant}</td>
                                <td style={{ textAlign: 'center' }}>{item.days}</td>
                                {showPrices && <><td style={{ textAlign: 'right' }}>${item.unit.toLocaleString()}</td><td style={{ textAlign: 'right' }}>${item.total.toLocaleString()}</td></>}
                            </tr>
                        ))}
                    </>
                )}

                {/* LOGÍSTICA */}
                {quote.items.logistica?.filter(item => item.name?.trim() && item.cant > 0).length > 0 && (
                    <>
                        <tr className="category-row text-left">
                            <td colSpan={showPrices ? 5 : 3} className="py-4">
                                <span className="px-3 py-1 rounded-lg text-[0.65rem] font-black uppercase tracking-wide border shadow-sm badge-logistica">
                                    LOGÍSTICA
                                </span>
                            </td>
                        </tr>
                        {quote.items.logistica.filter(item => item.name?.trim() && item.cant > 0).map((item, i) => (
                            <tr key={`log-${i}`}>
                                <td className="text-left">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-slate-800">{item.name}</span>
                                        {item.observation && <span className="text-[12px] text-slate-400 italic mt-0.5">{item.observation}</span>}
                                    </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>{item.cant}</td>
                                <td style={{ textAlign: 'center' }}>{item.days}</td>
                                {showPrices && <><td style={{ textAlign: 'right' }}>${item.unit.toLocaleString()}</td><td style={{ textAlign: 'right' }}>${item.total.toLocaleString()}</td></>}
                            </tr>
                        ))}
                    </>
                )}
            </tbody>
        </table>

        {showPrices ? (
            <div className="quote-footer">
                <div className="flex flex-col gap-4">
                    <div className="terms-yellow text-center">
                        <p>
                            Mobiliario a elección y sujeto a disponibilidad.<br />
                            Cotización válida por 7 días.
                        </p>
                    </div>

                    <div className="consider-section text-black bg-transparent p-0 border-t border-slate-100">
                        <h4 className="font-bold text-[3px] mb-0 uppercase tracking-widest">A CONSIDERAR:</h4>
                        <ul className="text-[2.5px] leading-tight space-y-0 list-none">
                            <li>* Se reserva cancelando el 50% del valor total y el 50% restante se debe cancelar 5 días antes del día del evento.</li>
                            <li>* En caso de suspensión del evento, es necesario avisar con 1 mes de anticipación al evento y con eso se hará la devolución del 50%.</li>
                            <li>* En caso de suspensión y no cumplir con el plazo mencionado anteriormente, se devolverá el 40% de lo pagado por gastos internos y suspensión de otros eventos.</li>
                        </ul>
                    </div>
                </div>
                <div className="totals-box">
                    {(() => {
                        let rawSubtotal = 0;
                        if (quote && quote.items) {
                            Object.values(quote.items).forEach(category => {
                                if (Array.isArray(category)) {
                                    category.forEach(item => {
                                        rawSubtotal += item.total || 0;
                                    });
                                }
                            });
                        }
                        const discountPercentage = quote.discount_percentage || quote.discountPercentage || 0;
                        const discountAmount = Math.round(rawSubtotal * (discountPercentage / 100));

                        return (
                            <>
                                {discountPercentage > 0 && (
                                    <>
                                        <div className="total-row"><span>SUBTOTAL:</span> <span>${rawSubtotal.toLocaleString()}</span></div>
                                        <div className="total-row text-red-500"><span>DESCUENTO ({discountPercentage}%):</span> <span>-${discountAmount.toLocaleString()}</span></div>
                                    </>
                                )}
                                <div className="total-row"><span>NETO:</span> <span>${quote.total.toLocaleString()}</span></div>
                                <div className="total-row"><span>IVA 19%:</span> <span>${Math.round(quote.total * 0.19).toLocaleString()}</span></div>
                                <div className="total-row grand-total"><span>TOTAL:</span> <span>${Math.round(quote.total * 1.19).toLocaleString()}</span></div>
                            </>
                        );
                    })()}
                </div>
            </div>
        ) : (
            <div className="logistics-footer no-print">
                <div className="mt-8 border-t border-slate-200 pt-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Notas de Logística</h4>
                    <div className="relative group">
                        <textarea
                            className="w-full min-h-[150px] p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="Escribe aquí notas importantes para el equipo de logística..."
                            value={logisticsNote}
                            onChange={(e) => setLogisticsNote(e.target.value)}
                        />
                        <button
                            onClick={handleSaveLogisticsNote}
                            className="mt-4 px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2 text-sm shadow-md active:scale-95"
                        >
                            <Save size={16} />
                            <span>Guardar Nota</span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* NOTA GLOBAL (Para Cliente y PDF) */}
        {quote.global_note && quote.global_note.trim() !== '' && (
            <div className={`mt-6 pt-6 ${showPrices ? 'border-t border-slate-200' : ''}`}>
                <h4 className="font-bold text-xs mb-2 uppercase tracking-widest text-slate-800">NOTA</h4>
                <p className="text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap">
                    {quote.global_note}
                </p>
            </div>
        )}

        {showPrices && (
            <div className="banking-footer text-left mt-8">
                <h3 className="font-bold border-b border-black/10 pb-1 mb-2">Datos de Transferencia</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                    <p><strong>Nombre:</strong> Puntourbano Ltda</p>
                    <p><strong>Rut:</strong> 76.107.262-5</p>
                    <p><strong>Banco:</strong> Estado</p>
                    <p><strong>N° Cuenta:</strong> 52970261966</p>
                    <p><strong>Tipo:</strong> Vista / Chequera Electrónica</p>
                    <p><strong>Email:</strong> <a href="mailto:puntourbanochile@gmail.com" className="text-blue-600 hover:underline">puntourbanochile@gmail.com</a></p>
                </div>
            </div>
        )}

        {/* Document Upload / View Section (Mock UI) */}
        {showPrices && (
            <div className="mt-8 border-t border-slate-200 pt-6 no-print">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Documentos Adjuntos</h4>
                <div className="grid grid-cols-2 gap-4">
                    {/* Voucher Card */}
                    <div className={`border rounded-xl p-4 flex flex-col justify-start transition-all ${quote.voucherUrls?.length > 0 ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50 hover:border-blue-300'}`}>
                        <div className="flex items-center justify-between w-full mb-3">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${quote.voucherUrls?.length > 0 ? 'bg-white text-emerald-600 shadow-sm' : 'bg-white text-slate-300'}`}>
                                    <Upload size={20} />
                                </div>
                                <div className="flex flex-col gap-1 w-full max-w-[200px]">
                                    <p className={`text-sm font-bold ${quote.voucherUrls?.length > 0 ? 'text-emerald-900' : 'text-slate-500'}`}>Comprobantes de Pago</p>

                                    {quote.voucherUrls?.length > 0 ? (
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {quote.voucherUrls.map((url, idx) => (
                                                <div key={idx} className="flex items-center bg-white border border-emerald-200 rounded-md overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                                    <a
                                                        href={url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-2 py-0.5 text-[0.65rem] font-bold text-emerald-700 hover:bg-emerald-50 transition-colors flex items-center gap-1 uppercase tracking-wider h-full"
                                                        title="Ver Voucher"
                                                    >
                                                        Voucher {idx + 1}
                                                    </a>
                                                    <button
                                                        onClick={(e) => { e.preventDefault(); handleDeleteVoucher(quote.id, url); }}
                                                        className="px-1.5 py-0.5 text-[0.65rem] text-slate-400 hover:text-red-500 hover:bg-red-50 border-l border-emerald-100 transition-colors h-full flex items-center justify-center"
                                                        title="Eliminar"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400">Pendiente de carga</p>
                                    )}
                                </div>
                            </div>

                            <label className={`flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 hover:shadow-md rounded-lg cursor-pointer transition-all`} title="Subir Archivo">
                                <input type="file" style={{ display: "none" }} onChange={(e) => handleFileUpload(e, quote.id, 'voucher')} accept=".pdf,.png,.jpg,.jpeg" />
                                <span className="text-xs font-bold">Subir{(quote.voucherUrls?.length > 0 || quote.voucherUrl) ? ' Otro' : ''}</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Invoice Card */}
                <div className={`border rounded-xl p-4 flex items-center justify-between transition-all ${quote.invoiceUrl ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-slate-50 hover:border-blue-300'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${quote.invoiceUrl ? 'bg-white text-blue-600 shadow-sm' : 'bg-white text-slate-300'}`}>
                            <FileText size={20} />
                        </div>
                        <div>
                            <p className={`text-sm font-bold ${quote.invoiceUrl ? 'text-blue-900' : 'text-slate-500'}`}>Factura Tributaria</p>
                            <p className="text-xs text-slate-400">{quote.invoiceUrl ? 'Documento disponible' : 'Pendiente de carga'}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {quote.invoiceUrl && (
                            <a href={quote.invoiceUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white text-blue-600 hover:text-blue-700 hover:shadow-md rounded-lg transition-all" title="Ver Documento">
                                <Eye size={18} />
                            </a>
                        )}
                        <label className={`flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 ${quote.invoiceUrl ? 'text-slate-500 hover:text-blue-600 hover:border-blue-300' : 'text-blue-600 hover:bg-blue-50 hover:border-blue-300'} hover:shadow-md rounded-lg cursor-pointer transition-all`} title={quote.invoiceUrl ? "Reemplazar Archivo" : "Subir Archivo"}>
                            <input type="file" style={{ display: "none" }} onChange={(e) => handleFileUpload(e, quote.id, 'invoice')} accept=".pdf,.png,.jpg,.jpeg" />
                            <Upload size={16} />
                            <span className="text-xs font-bold">{quote.invoiceUrl ? 'Reemplazar' : 'Subir'}</span>
                        </label>
                    </div>
                </div>
            </div>
        )}
    </div>
);


const QuoteForm = ({ onSave, onCancel, clientDatabase, events, setEvents, inventoryDatabase, setQuotes, quotes, setShowToast, setView, fetchInventory, editingQuote }) => {
    const [newQuote, setNewQuote] = useState(editingQuote ? {
        ...editingQuote,
        client: editingQuote.client || '',
        clientType: editingQuote.client_type || editingQuote.clientType || '',
        location: editingQuote.location || '',
        eventDate: editingQuote.event_date || editingQuote.eventDate || '',
        expirationDate: editingQuote.expiration_date || editingQuote.expirationDate || '',
        eventName: editingQuote.event_name || editingQuote.eventName || '',
        eventNotes: editingQuote.event_notes || editingQuote.eventNotes || '',
        global_note: editingQuote.global_note || '',
        items: editingQuote.items || {
            lounge: [],
            accesorios: [],
            deco: [],
            extras: [],
            logistica: []
        },
        timing: editingQuote.timing || {
            montaje: '',
            desmontaje: '',
            contactPhone: ''
        },
        discountPercentage: editingQuote.discount_percentage || editingQuote.discountPercentage || 0
    } : {
        client: '',
        clientType: '',
        location: '',
        eventDate: '',
        expirationDate: '',
        eventName: '',
        eventNotes: '',
        global_note: '',
        items: {
            lounge: [],
            accesorios: [],
            deco: [],
            extras: [],
            logistica: []
        },
        timing: {
            montaje: '',
            desmontaje: '',
            contactPhone: ''
        },
        discountPercentage: 0
    });

    const sanitizeDate = (val) => {
        if (!val || val.trim() === '') return '';
        return val.trim();
    };

    const toISODate = (val) => {
        let clean = sanitizeDate(val);
        if (!clean) return null;

        // Strip day name if present (e.g., "Sáb 05/03" -> "05/03")
        // Uses regex to catch accented days like Sáb, Mié etc
        clean = clean.replace(/^[A-ZáéíóúÁÉÍÓÚ][a-záéíóú]{2,3}\s+/i, '');

        // Remove time part for ISO date comparison/storage if necessary
        const dateOnly = clean.split(' ')[0];

        const currentYear = new Date().getFullYear();
        const fullDateMatch = dateOnly.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (fullDateMatch) {
            const [, day, month, year] = fullDateMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        const dayMonthMatch = dateOnly.match(/^(\d{1,2})\/(\d{1,2})/);
        if (dayMonthMatch) {
            const [, day, month] = dayMonthMatch;
            return `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        // If it's already ISO YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
            return clean.substring(0, 10);
        }

        return clean;
    };

    const handleBlurDate = (field, value) => {
        if (!value) return;
        const formatted = formatDateWithDay(value);
        if (field === 'eventDate') {
            setNewQuote({ ...newQuote, eventDate: formatted });
        } else {
            setNewQuote({ ...newQuote, timing: { ...newQuote.timing, [field]: formatted } });
        }
    };

    const calculateAvailability = (inventoryId, eventDateStr) => {
        const item = inventoryDatabase.find(inv => inv.id === inventoryId);
        if (!item) return 0;
        const totalCapacity = item.stock;
        const selectedDate = toISODate(eventDateStr);
        if (!selectedDate) return totalCapacity;
        const allocated = quotes.reduce((sum, q) => {
            const quoteDate = q.event_date || q.eventDate;
            const isSameDate = quoteDate === selectedDate || (quoteDate && toISODate(quoteDate) === selectedDate);
            if (isSameDate && q.status !== 'No Aceptada' && q.id !== newQuote.id) {
                let quoteItemSum = 0;
                Object.values(q.items || {}).forEach(categoryItems => {
                    if (Array.isArray(categoryItems)) {
                        categoryItems.forEach(qi => {
                            if (qi.inventory_id === inventoryId) {
                                quoteItemSum += qi.cant || 0;
                            }
                        });
                    }
                });
                return sum + quoteItemSum;
            }
            return sum;
        }, 0);
        return Math.max(0, totalCapacity - allocated);
    };

    // Re-calculate availability for all items when date changes
    useEffect(() => {
        const updatedItems = { ...newQuote.items };
        let changed = false;
        Object.keys(updatedItems).forEach(cat => {
            if (Array.isArray(updatedItems[cat])) {
                updatedItems[cat] = updatedItems[cat].map(item => {
                    if (item.inventory_id) {
                        const freshAvailability = calculateAvailability(item.inventory_id, newQuote.eventDate);
                        if (item.maxStock !== freshAvailability) {
                            changed = true;
                            return { ...item, maxStock: freshAvailability };
                        }
                    }
                    return item;
                });
            }
        });
        if (changed) {
            setNewQuote(prev => ({ ...prev, items: updatedItems }));
        }
    }, [newQuote.eventDate]);

    const [clientSuggestions, setClientSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeSuggestion, setActiveSuggestion] = useState({ category: null, index: null });

    const handleClientChange = (e) => {
        const value = e.target.value;
        setNewQuote({ ...newQuote, client: value });

        if (value.length > 1) {
            const matches = clientDatabase.filter(c => c.name.toLowerCase().includes(value.toLowerCase()));
            setClientSuggestions(matches);
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    };

    const selectClient = (client) => {
        setNewQuote({
            ...newQuote,
            client: client.name,
            clientType: client.type,
            timing: {
                ...newQuote.timing,
                contactPhone: client.phone || ''
            }
        });
        setShowSuggestions(false);
    };

    const handleAddItem = (category) => {
        setNewQuote({
            ...newQuote,
            items: {
                ...newQuote.items,
                [category]: [...newQuote.items[category], { name: '', observation: '', cant: 1, days: 1, unit: 0, total: 0 }]
            }
        });
    };

    const handleItemChange = (category, index, field, value) => {
        const updatedItems = [...newQuote.items[category]];

        // Cap quantity to maxStock if defined
        if (field === 'cant' && updatedItems[index].maxStock !== undefined && value > updatedItems[index].maxStock) {
            value = updatedItems[index].maxStock;
        }

        updatedItems[index][field] = value;
        if (field === 'cant' || field === 'days' || field === 'unit') {
            updatedItems[index].total = (updatedItems[index].cant || 0) * (updatedItems[index].days || 0) * (updatedItems[index].unit || 0);
        }
        if (field === 'name') {
            setActiveSuggestion({ category, index });
        }
        setNewQuote({
            ...newQuote,
            items: {
                ...newQuote.items,
                [category]: updatedItems
            }
        });
    };

    const selectInventoryItem = (category, index, invItem) => {
        const updatedItems = [...newQuote.items[category]];
        updatedItems[index].name = invItem.name;
        updatedItems[index].unit = invItem.price || 0;
        updatedItems[index].inventory_id = invItem.id;
        // Calculate dynamic availability for the selected date
        updatedItems[index].maxStock = calculateAvailability(invItem.id, newQuote.eventDate);
        updatedItems[index].total = updatedItems[index].cant * updatedItems[index].days * updatedItems[index].unit;
        setNewQuote({
            ...newQuote,
            items: {
                ...newQuote.items,
                [category]: updatedItems
            }
        });
        setActiveSuggestion({ category: null, index: null });
    };

    const handleRemoveItem = (category, index) => {
        const updatedItems = newQuote.items[category].filter((_, i) => i !== index);
        setNewQuote({
            ...newQuote,
            items: {
                ...newQuote.items,
                [category]: updatedItems
            }
        });
    };

    const calculateLocalTotal = (quote) => {
        return calculateTotal(quote);
    };

    const handleSaveQuote = async () => {
        const total = calculateLocalTotal(newQuote);

        const sanitizedTiming = {
            ...newQuote.timing,
            montaje: formatDateWithDay(newQuote.timing?.montaje),
            desmontaje: formatDateWithDay(newQuote.timing?.desmontaje),
            event_date_full: formatDateWithDay(newQuote.eventDate),
        };

        try {
            let quoteId = newQuote.id;

            if (!editingQuote) {
                const { data: nextId, error: idError } = await supabase.rpc('get_next_quote_id');
                if (idError) throw idError;
                quoteId = nextId;
            }

            const isoEventDate = toISODate(newQuote.eventDate);
            const isoPaymentDate = toISODate(newQuote.paymentDate);

            const quoteToSaveDB = {
                client: newQuote.client,
                client_type: newQuote.clientType,
                location: newQuote.location,
                event_date: isoEventDate || null,
                event_name: newQuote.eventName,
                total: total,
                discount_percentage: newQuote.discountPercentage || 0,
                status: newQuote.status || 'Borrador',
                payment_date: isoPaymentDate || null,
                expiration_date: newQuote.expirationDate || null,
                items: newQuote.items,
                timing: sanitizedTiming,
                event_notes: newQuote.eventNotes,
                global_note: newQuote.global_note || ''
            };

            const quoteToSaveLocal = {
                ...newQuote,
                id: quoteId,
                total: total,
                discount_percentage: newQuote.discountPercentage || 0,
                status: newQuote.status || 'Borrador',
                paymentDate: isoPaymentDate || '',
                timing: sanitizedTiming,
                eventDate: isoEventDate || '',
                clientType: newQuote.clientType,
                eventName: newQuote.eventName,
                eventNotes: newQuote.eventNotes,
                paymentStatus: newQuote.paymentStatus || 'Impaga'
            };

            if (editingQuote) {
                const { error: quoteError } = await supabase.from('quotes').update(quoteToSaveDB).eq('id', quoteId);
                if (quoteError) throw quoteError;
                setQuotes(prevQuotes => prevQuotes.map(q => q.id === quoteId ? quoteToSaveLocal : q));
            } else {
                const { error: quoteError } = await supabase.from('quotes').insert([{ id: quoteId, ...quoteToSaveDB }]);
                if (quoteError) throw quoteError;
                setQuotes(prevQuotes => [quoteToSaveLocal, ...prevQuotes]);
            }

            setShowToast(editingQuote ? 'Cotización actualizada exitosamente' : 'Cotización guardada exitosamente');
            setView('list');
            fetchInventory();
        } catch (error) {
            console.error('Error saving quote:', error);
            alert('Error al guardar cotización: ' + error.message);
        }
    };

    return (
        <motion.div
            key="create"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="card p-8 shadow-premium"
        >
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
                <h2 className="text-xl font-black">Nueva Cotización</h2>
                <button onClick={onCancel} className="text-slate-400 hover:text-slate-900 font-bold text-sm">Cancelar</button>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8 relative z-[100]">
                <div className="relative z-50">
                    <InputField
                        label="Cliente"
                        value={newQuote.client}
                        onChange={handleClientChange}
                        placeholder="Ej: Productora XYZ"
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    />
                    {showSuggestions && (
                        <div className="absolute w-full left-0 top-full mt-2 bg-white rounded-xl shadow-2xl overflow-y-auto p-2 border border-slate-200 z-[1000] max-h-[250px]">
                            {clientSuggestions.length > 0 ? (
                                clientSuggestions.map((client, idx) => (
                                    <div
                                        key={idx}
                                        className="px-5 py-3 bg-white hover:bg-blue-50 cursor-pointer flex flex-col border-b border-slate-50 last:border-none transition-colors rounded-lg"
                                        onClick={() => selectClient(client)}
                                    >
                                        <span className="font-bold text-sm text-slate-800">{client.name}</span>
                                        <span className="text-[0.7rem] text-slate-400 font-medium uppercase tracking-wider">{client.contact}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="px-5 py-4 text-slate-400 text-xs italic">No se encontraron clientes</div>
                            )}
                        </div>
                    )}
                </div>
                <InputField label="Teléfono Contacto" value={newQuote.timing?.contactPhone || ''} onChange={(e) => setNewQuote({ ...newQuote, timing: { ...newQuote.timing, contactPhone: e.target.value } })} placeholder="Opcional. Ej: +56 9 1234 5678" />
                <InputField label="Nombre Evento" value={newQuote.eventName} onChange={(e) => setNewQuote({ ...newQuote, eventName: e.target.value })} placeholder="Ej: Lanzamiento Marca" />
                <InputField label="Locación" value={newQuote.location} onChange={(e) => setNewQuote({ ...newQuote, location: e.target.value })} placeholder="Ej: Espacio Riesco" />
                <div className="grid grid-cols-2 gap-4">
                    <InputField
                        label="Fecha Evento"
                        value={newQuote.eventDate}
                        onChange={(e) => setNewQuote({ ...newQuote, eventDate: e.target.value })}
                        onBlur={(e) => handleBlurDate('eventDate', e.target.value)}
                        placeholder="DD/MM HH:MM"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <InputField
                        label="Montaje"
                        value={newQuote.timing.montaje}
                        onChange={(e) => setNewQuote({ ...newQuote, timing: { ...newQuote.timing, montaje: e.target.value } })}
                        onBlur={(e) => handleBlurDate('montaje', e.target.value)}
                        placeholder="DD/MM HH:MM"
                    />
                    <InputField
                        label="Desmontaje"
                        value={newQuote.timing.desmontaje}
                        onChange={(e) => setNewQuote({ ...newQuote, timing: { ...newQuote.timing, desmontaje: e.target.value } })}
                        onBlur={(e) => handleBlurDate('desmontaje', e.target.value)}
                        placeholder="DD/MM HH:MM"
                    />
                </div>
                <div className="col-span-2">
                    <label className="label-field">Evento (Notas Libres para el Calendario)</label>
                    <textarea
                        className="input-field min-h-[100px] text-sm font-medium"
                        value={newQuote.eventNotes}
                        onChange={(e) => setNewQuote({ ...newQuote, eventNotes: e.target.value })}
                        placeholder="Escribe aquí los detalles que aparecerán automáticamente en el detalle del calendario..."
                    />
                </div>
                <div className="col-span-2">
                    <label className="label-field">Nota Global (Visible en la Cotización para el Cliente)</label>
                    <textarea
                        className="input-field min-h-[100px] text-sm font-medium"
                        value={newQuote.global_note || ''}
                        onChange={(e) => setNewQuote({ ...newQuote, global_note: e.target.value })}
                        placeholder="Escribe condiciones especiales, advertencias o comentarios que se imprimirán en el PDF y verá el cliente..."
                    />
                </div>
            </div>

            <div className="space-y-10">
                {['lounge', 'accesorios', 'deco', 'extras', 'logistica'].map((category) => (
                    <div key={category} className="group relative">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-8 w-1 bg-blue-500 rounded-full"></div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">{category}</h3>
                        </div>

                        <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 transition-all hover:bg-slate-50 hover:shadow-sm">
                            <div className="space-y-4">
                                {newQuote.items[category].map((item, index) => (
                                    <div key={index} className="grid grid-cols-12 gap-4 items-start animate-in fade-in slide-in-from-bottom-2 duration-300 relative" style={{ zIndex: 50 - index }}>
                                        <div className="col-span-12 md:col-span-6 relative z-50">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block pl-1">Item</label>
                                            <input
                                                type="text"
                                                placeholder="Ej: Silla Tiffany"
                                                className="w-full input-field p-3 text-sm font-medium mb-0"
                                                value={item.name}
                                                onChange={(e) => handleItemChange(category, index, 'name', e.target.value)}
                                                onBlur={() => setTimeout(() => setActiveSuggestion({ category: null, index: null }), 200)}
                                            />
                                            {activeSuggestion.category === category && activeSuggestion.index === index && item.name.length > 2 && (
                                                <div className="absolute w-full left-0 top-14 mt-1 bg-white rounded-xl shadow-2xl border border-slate-100 z-[1001] max-h-[200px] overflow-y-auto p-1">
                                                    {inventoryDatabase
                                                        .filter(inv => inv.name.toLowerCase().includes(item.name.toLowerCase()) ||
                                                            inv.code.toLowerCase().includes(item.name.toLowerCase()))
                                                        .slice(0, 10)
                                                        .map((inv, idx) => {
                                                            const availability = calculateAvailability(inv.id, newQuote.eventDate);
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    className={`px-4 py-2 rounded-lg flex justify-between items-center transition-colors ${availability > 0 ? 'bg-white hover:bg-blue-50 cursor-pointer' : 'bg-slate-50 opacity-60 cursor-not-allowed'}`}
                                                                    onClick={() => availability > 0 && selectInventoryItem(category, index, inv)}
                                                                >
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-sm font-bold text-slate-700">{inv.name}</span>
                                                                            {availability <= 0 && <span className="text-[0.6rem] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase">Agotado</span>}
                                                                        </div>
                                                                        <span className="text-[0.65rem] text-slate-400 font-black uppercase tracking-widest">{inv.code} {availability > 0 ? `| Disp: ${availability}` : ''}</span>
                                                                    </div>
                                                                    <span className="text-xs font-black text-blue-600">${inv.price?.toLocaleString()}</span>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-span-3 md:col-span-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block text-center">Cant</label>
                                            <input
                                                type="number"
                                                className={`w-full input-field p-3 text-sm font-bold text-center ${item.maxStock !== undefined && item.cant >= item.maxStock ? 'border-amber-300 bg-amber-50 focus:border-amber-400 focus:ring-amber-200 text-amber-700' : ''}`}
                                                value={item.cant}
                                                onChange={(e) => handleItemChange(category, index, 'cant', parseInt(e.target.value) || 0)}
                                                max={item.maxStock}
                                                min="1"
                                                title={item.maxStock !== undefined ? `Stock Disponible: ${item.maxStock}` : ''}
                                            />
                                            {item.maxStock !== undefined && (
                                                <div className="text-[9px] text-center mt-1 font-bold text-amber-600 leading-tight">
                                                    Máx: {item.maxStock}
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-span-3 md:col-span-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block text-center">Días</label>
                                            <input
                                                type="number"
                                                className="w-full input-field p-3 text-sm font-bold text-center"
                                                value={item.days}
                                                onChange={(e) => handleItemChange(category, index, 'days', parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div className="col-span-5 md:col-span-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block text-right">Valor Unit</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                                                <input
                                                    type="number"
                                                    className="w-full input-field p-3 pl-6 text-sm font-bold text-right"
                                                    value={item.unit}
                                                    onChange={(e) => handleItemChange(category, index, 'unit', parseInt(e.target.value) || 0)}
                                                />
                                            </div>
                                        </div>
                                        <div className="col-span-1 md:col-span-2 flex flex-col items-end justify-center h-full pt-6">
                                            <div className="flex items-center gap-3">
                                                <div className="text-right hidden md:block">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Subtotal</p>
                                                    <p className="text-sm font-black text-slate-700">${item.total.toLocaleString()}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveItem(category, index)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="col-span-12 mt-2">
                                            <textarea
                                                placeholder="Observaciones especiales..."
                                                className="w-full input-field p-3 text-sm font-medium mb-0 min-h-[60px]"
                                                value={item.observation || ''}
                                                onChange={(e) => handleItemChange(category, index, 'observation', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => handleAddItem(category)}
                                className="mt-4 w-full py-3 flex items-center justify-center gap-2 text-blue-600 font-bold text-sm bg-blue-50/50 hover:bg-blue-50 rounded-xl border border-blue-100 hover:border-blue-200 transition-all group"
                            >
                                <Plus size={16} className="group-hover:scale-110 transition-transform" />
                                <span>Agregar Ítem</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 mb-4 flex justify-end">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col md:flex-row items-end gap-4 w-full md:w-auto shadow-sm">
                    <div className="w-full md:w-64">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block border-l-2 border-blue-500 pl-2">Descuento Global (%)</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="Ej: 10"
                                className="w-full input-field p-4 text-sm font-bold bg-white"
                                value={newQuote.discountPercentage || ''}
                                onChange={(e) => setNewQuote({ ...newQuote, discountPercentage: parseFloat(e.target.value) || 0 })}
                            />
                            <button
                                type="button"
                                className="px-6 py-4 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                                onClick={(e) => {
                                    e.preventDefault();
                                    // React state update triggers recalculation automatically,
                                    // this button is mostly visual feedback for the user
                                }}
                            >
                                Aplicar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 bg-slate-900 rounded-2xl p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8 w-full">
                    <div className="text-center md:text-left">
                        <p className="text-slate-400 text-sm font-medium mb-1">Resumen del Presupuesto</p>
                        <h3 className="text-2xl font-bold tracking-tight">Total Estimado</h3>
                    </div>
                    <div className="flex flex-col md:flex-row items-center gap-6 md:gap-12 w-full md:w-auto">
                        <div className="flex flex-col items-end gap-1">
                            {(() => {
                                const itemsSubtotal = calculateSubtotal(newQuote);
                                const discountPercentage = newQuote.discountPercentage || 0;
                                const discountAmount = Math.round(itemsSubtotal * (discountPercentage / 100));
                                const net = itemsSubtotal - discountAmount;
                                const iva = Math.round(net * 0.19);
                                const total = Math.round(net + iva);

                                return (
                                    <>
                                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                                            <span>NETO: ${itemsSubtotal.toLocaleString()}</span>
                                            {discountPercentage > 0 && (
                                                <span className="text-red-400">DESC {discountPercentage}%: -${discountAmount.toLocaleString()}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                                            <span>NETO C/DESC: ${net.toLocaleString()}</span>
                                            <span>IVA: ${iva.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-baseline gap-2 mt-1">
                                            <span className="text-3xl font-black tracking-tight text-blue-400">${total.toLocaleString()}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CON IVA</span>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                        <button
                            onClick={handleSaveQuote}
                            className="w-full md:w-auto px-8 py-4 bg-white text-slate-900 font-black rounded-xl hover:bg-blue-50 shadow-lg shadow-white/10 transition-all flex items-center justify-center gap-2 hover:scale-105 active:scale-95"
                        >
                            <span>Guardar Cotización</span>
                            <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const QuoteEngine = ({ quotes, setQuotes, events, setEvents }) => {
    const [view, setView] = useState('list');
    const [selectedQuote, setSelectedQuote] = useState(null);
    const [toastConfig, setToastConfig] = useState({ show: false, message: '', type: 'success' });

    // Highlighting State
    const [highlightMode, setHighlightMode] = useState(null); // 'proximos', 'pagados', 'impagos'
    const [showFabOptions, setShowFabOptions] = useState(false);

    // Week detection helpers
    const getCurrentWeekRange = () => {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)
        const diffToMonday = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(new Date().setDate(diffToMonday));
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        return { start: monday, end: sunday };
    };

    const isDateInCurrentWeek = (dateStr) => {
        if (!dateStr) return false;
        // Use a more robust date parsing for DD/MM/YYYY or YYYY-MM-DD
        let normalizedDate;
        if (dateStr.includes('/')) {
            const [d, m, y] = dateStr.split(' ')[0].split('/');
            normalizedDate = new Date(`${y}-${m}-${d}T12:00:00`);
        } else {
            normalizedDate = new Date(dateStr.substring(0, 10) + 'T12:00:00');
        }

        if (isNaN(normalizedDate.getTime())) return false;

        const { start, end } = getCurrentWeekRange();
        return normalizedDate >= start && normalizedDate <= end;
    };

    const isDateInCurrentMonth = (dateStr) => {
        if (!dateStr) return false;
        let normalizedDate;
        if (dateStr.includes('/')) {
            const [d, m, y] = dateStr.split(' ')[0].split('/');
            normalizedDate = new Date(`${y}-${m}-${d}T12:00:00`);
        } else {
            normalizedDate = new Date(dateStr.substring(0, 10) + 'T12:00:00');
        }

        if (isNaN(normalizedDate.getTime())) return false;

        const now = new Date();
        return normalizedDate.getMonth() === now.getMonth() && normalizedDate.getFullYear() === now.getFullYear();
    };

    const isUpcoming = (dateStr) => {
        if (!dateStr) return false;
        let normalizedDate;
        if (dateStr.includes('/')) {
            const [d, m, y] = dateStr.split(' ')[0].split('/');
            normalizedDate = new Date(`${y}-${m}-${d}T12:00:00`);
        } else {
            normalizedDate = new Date(dateStr.substring(0, 10) + 'T12:00:00');
        }
        if (isNaN(normalizedDate.getTime())) return false;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return normalizedDate >= today;
    };

    const getRowHighlightClass = (q) => {
        if (!highlightMode) return '';
        const dateStr = q.eventDate || q.event_date;

        if (highlightMode === 'proximos' && isDateInCurrentWeek(dateStr)) {
            return 'row-highlight-upcoming highlighted-row';
        }
        if (highlightMode === 'pagados' && q.paymentStatus === 'Pagada' && isDateInCurrentMonth(dateStr)) {
            return 'row-highlight-paid highlighted-row';
        }
        if (highlightMode === 'impagos' && q.paymentStatus !== 'Pagada' && isDateInCurrentMonth(dateStr)) {
            return 'row-highlight-unpaid highlighted-row';
        }
        return '';
    };

    // Helper to show toast with message
    const setShowToast = (message, type = 'success') => {
        setToastConfig({ show: true, message, type });
        setTimeout(() => setToastConfig({ show: false, message: '', type: 'success' }), 3000);
    };

    // Filters
    const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const currentYear = new Date().getFullYear().toString();
    const [mainFilterInput, setMainFilterInput] = useState({ start: '', end: '', status: 'Todas', paymentStatus: 'Todas', month: currentMonth, year: currentYear });
    const [activeFilters, setActiveFilters] = useState({ start: '', end: '', status: 'Todas', paymentStatus: 'Todas', month: currentMonth, year: currentYear });
    const [searchTerm, setSearchTerm] = useState('');

    const [clientDatabase, setClientDatabase] = useState([]);
    const [inventoryDatabase, setInventoryDatabase] = useState([]);
    const [activeSuggestion, setActiveSuggestion] = useState({ category: null, index: null });
    const [logisticsNote, setLogisticsNote] = useState('');

    useEffect(() => {
        if (selectedQuote) {
            setLogisticsNote(selectedQuote.logistics_notes || '');
        }
    }, [selectedQuote]);

    const handleSaveLogisticsNote = async () => {
        if (!selectedQuote) return;
        try {
            const { error } = await supabase
                .from('quotes')
                .update({ logistics_notes: logisticsNote })
                .eq('id', selectedQuote.id);

            if (error) throw error;

            // Update local state
            const updatedQuotes = quotes.map(q =>
                q.id === selectedQuote.id ? { ...q, logistics_notes: logisticsNote } : q
            );
            setQuotes(updatedQuotes);
            setSelectedQuote({ ...selectedQuote, logistics_notes: logisticsNote });
            setShowToast('Nota de logística guardada');
        } catch (error) {
            console.error('Error saving logistics note:', error);
            setShowToast('Error al guardar nota', 'error');
        }
    };

    const fetchInventory = async () => {
        const { data, error } = await supabase.from('inventory').select('*');
        if (!error && data) {
            setInventoryDatabase(data);
        }
    };

    useEffect(() => {
        const fetchClients = async () => {
            const { data, error } = await supabase.from('clients').select('*');
            if (!error && data) {
                setClientDatabase(data);
            }
        };
        fetchClients();
        fetchInventory();
    }, []);


    const handleStatusChange = async (e, quoteId) => {
        e.stopPropagation();
        const newStatus = e.target.value;

        try {
            const { error } = await supabase.from('quotes').update({ status: newStatus }).eq('id', quoteId);
            if (error) throw error;

            const updatedQuotes = quotes.map(q => q.id === quoteId ? { ...q, status: newStatus } : q);
            setQuotes(updatedQuotes);
            if (newStatus === 'Aceptada') {
                const quoteToApprove = quotes.find(q => q.id === quoteId);

                if (quoteToApprove && (quoteToApprove.eventDate || quoteToApprove.event_date)) {
                    const eventTitle = quoteToApprove.eventNotes || `${quoteToApprove.client} - ${quoteToApprove.eventName || 'Evento'}`;
                    const eventDescription = `Cliente: ${quoteToApprove.client} - Evento: ${quoteToApprove.eventName || 'N/A'}`;
                    const rawDate = quoteToApprove.event_date || quoteToApprove.eventDate;
                    const eventDate = quoteToApprove.event_date || (quoteToApprove.eventDate ? window.toISODate ? window.toISODate(quoteToApprove.eventDate) : quoteToApprove.eventDate.split(' ')[1] || quoteToApprove.eventDate : null);

                    // Extract time if exists
                    let eventTime = '09:00 AM';
                    const timeMatch = rawDate ? rawDate.match(/\d{2}:\d{2}\s?(?:AM|PM|am|pm)?/) : null;
                    if (timeMatch) {
                        eventTime = timeMatch[0];
                    } else if (rawDate && rawDate.includes('a las')) {
                        const rawTime = rawDate.split('a las')[1].trim();
                        eventTime = rawTime;
                    }

                    // Check for existing event to avoid duplicates
                    const { data: existingEvents } = await supabase
                        .from('events')
                        .select('id')
                        .eq('date', eventDate)
                        .eq('title', eventTitle)
                        .eq('description', eventDescription);

                    if (!existingEvents || existingEvents.length === 0) {
                        const newEvent = {
                            date: eventDate,
                            title: eventTitle,
                            type: 'note',
                            description: eventDescription,
                            time: eventTime
                        };

                        const { data: eventData, error: eventError } = await supabase.from('events').insert([newEvent]).select();
                        if (!eventError && eventData) {
                            setEvents(prev => [...prev, ...eventData]);
                        }
                    }
                }

                setShowToast('¡Éxito! Cotización aceptada.');
            } else {
                setShowToast(`Estado actualizado a: ${newStatus}`);
            }
        } catch (error) {
            console.error('Error updating status:', error);
            setShowToast('Error al actualizar estado', 'error');
        }
    };

    // Handle Payment Status Change
    const handlePaymentStatusChange = async (e, quoteId) => {
        const newPaymentStatus = e.target.value;

        // Update local state
        const updatedQuotes = quotes.map(q =>
            q.id === quoteId ? { ...q, paymentStatus: newPaymentStatus } : q
        );
        setQuotes(updatedQuotes);

        // Update selected quote if open
        if (selectedQuote && selectedQuote.id === quoteId) {
            setSelectedQuote({ ...selectedQuote, paymentStatus: newPaymentStatus });
        }

        try {
            const { error } = await supabase
                .from('quotes')
                .update({ payment_status: newPaymentStatus })
                .eq('id', quoteId);

            if (error) throw error;
            setShowToast('Estado de pago actualizado.');
        } catch (error) {
            console.error('Error updating payment status:', error);
            setShowToast('Error al actualizar pago', 'error');
        }
    };

    const handleEventDateChange = async (e, quoteId) => {
        const val = e.target.value;
        const formatted = formatDateWithDay(val);
        const isoDate = toISODate(val);

        const updatedQuotes = quotes.map(q => {
            if (q.id === quoteId) {
                const updatedTiming = { ...q.timing, event_date_full: formatted };
                return { ...q, eventDate: formatted, timing: updatedTiming };
            }
            return q;
        });
        setQuotes(updatedQuotes);

        try {
            const currentQuote = quotes.find(q => q.id === quoteId);
            const updatedTiming = { ...currentQuote.timing, event_date_full: formatted };

            const { error } = await supabase.from('quotes').update({
                event_date: isoDate,
                timing: updatedTiming
            }).eq('id', quoteId);

            if (error) throw error;
            fetchInventory();
        } catch (err) {
            console.error('Error updating event date:', err);
            setShowToast('Error al actualizar fecha', 'error');
        }
    };

    const handlePaymentDateChange = async (e, quoteId) => {
        e.stopPropagation();
        const newDate = e.target.value;

        try {
            const { error } = await supabase.from('quotes').update({ payment_date: newDate || null }).eq('id', quoteId);
            if (error) throw error;

            const updatedQuotes = quotes.map(q => q.id === quoteId ? { ...q, paymentDate: newDate } : q);
            setQuotes(updatedQuotes);

            if (selectedQuote && selectedQuote.id === quoteId) {
                setSelectedQuote({ ...selectedQuote, paymentDate: newDate });
            }
            setShowToast('Fecha de pago actualizada.');

        } catch (error) {
            console.error('Error updating payment date:', error);
            setShowToast('Error al actualizar fecha pago', 'error');
        }
    };

    const handleFilterChange = (e, field) => {
        setMainFilterInput({ ...mainFilterInput, [field]: e.target.value });
    };

    const applyFilters = () => {
        setActiveFilters(mainFilterInput);
    };

    // Filter Logic
    const filteredQuotes = quotes.filter(q => {
        const matchesSearch = q.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
            q.id.toString().includes(searchTerm) ||
            (q.eventName && q.eventName.toLowerCase().includes(searchTerm.toLowerCase()));

        // Date Filter
        let matchesDate = true;

        let targetDate = '';
        if (q.event_date) {
            targetDate = q.event_date.split('T')[0];
        } else if (q.eventDate) {
            const dateMatch = q.eventDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (dateMatch) {
                targetDate = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
            } else {
                targetDate = q.eventDate.split('T')[0];
            }
        }
        if (!targetDate && q.created_at) {
            targetDate = q.created_at.split('T')[0];
        }

        if (activeFilters.start && activeFilters.end) {
            if (targetDate) {
                matchesDate = targetDate >= activeFilters.start && targetDate <= activeFilters.end;
            }
        }

        if (activeFilters.month && matchesDate) {
            if (targetDate) {
                const month = targetDate.split('-')[1];
                if (month !== activeFilters.month) {
                    matchesDate = false;
                }
            } else {
                matchesDate = false;
            }
        }

        if (activeFilters.year && matchesDate) {
            if (targetDate) {
                const year = targetDate.split('-')[0];
                if (year !== activeFilters.year) {
                    matchesDate = false;
                }
            } else {
                matchesDate = false;
            }
        }

        // Status Filter
        let matchesStatus = true;
        if (activeFilters.status !== 'Todas') {
            matchesStatus = q.status === activeFilters.status;
        }

        // Payment Status Filter
        let matchesPaymentStatus = true;
        if (activeFilters.paymentStatus !== 'Todas') {
            matchesPaymentStatus = (q.paymentStatus || 'Impaga') === activeFilters.paymentStatus;
        }

        // highlightMode Filter
        let matchesHighlight = true;
        if (highlightMode === 'impagos') {
            const isUnpaid = q.paymentStatus !== 'Pagada';
            const isThisMonth = isDateInCurrentMonth(q.eventDate || q.event_date);
            matchesHighlight = isUnpaid && isThisMonth;
        } else if (highlightMode === 'pagados') {
            const isPaid = q.paymentStatus === 'Pagada';
            const isThisMonth = isDateInCurrentMonth(q.eventDate || q.event_date);
            matchesHighlight = isPaid && isThisMonth;
        } else if (highlightMode === 'proximos') {
            matchesHighlight = isDateInCurrentWeek(q.eventDate || q.event_date);
        }

        const matchesSearchValue = searchTerm.length > 0;
        return matchesSearch && (matchesDate || matchesSearchValue) && matchesStatus && matchesPaymentStatus && matchesHighlight;
    }).sort((a, b) => {
        const getSortTime = (q) => {
            if (q.event_date) return new Date(q.event_date).getTime();
            if (q.eventDate) {
                const m = q.eventDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                if (m) return new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T00:00:00`).getTime();
            }
            return new Date(q.created_at || '1970-01-01').getTime();
        };

        const dateA = getSortTime(a);
        const dateB = getSortTime(b);

        const valA = isNaN(dateA) ? 0 : dateA;
        const valB = isNaN(dateB) ? 0 : dateB;

        if (valA - valB === 0) {
            return b.id - a.id;
        }
        return valA - valB;
    });

    const sendWhatsAppNotification = (quote) => {
        const clientPhone = quote.timing?.contactPhone?.replace(/\D/g, '') || '56912345678';
        const message = `Hola, envío cotización #${quote.id} de Punto Urbano para el evento: ${quote.eventName || 'Evento'}. Quedamos atentos.`;
        const url = `https://wa.me/${clientPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const generateQuotePDF = async (quote, isLogistics = false) => {
        const doc = new jsPDF();

        // Load Logo
        const logoUrl = '/logo.png';
        try {
            const img = new Image();
            img.src = logoUrl;
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            // Add Logo (x, y, width, height)
            doc.addImage(img, 'PNG', 133, 18, 55, 22);
        } catch (error) {
            console.warn('Logo not found', error);
        }

        // --- Header Info (Right Side with Logo) ---
        // We moved the "N° PRESUPUESTO" to Y = 55 to align with the bottom left text.

        doc.setTextColor(30, 41, 59); // Slate 800 (Dark)
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(isLogistics ? `GUÍA LOGÍSTICA: #${quote.id}` : `N° PRESUPUESTO: #${quote.id}`, 190, 55, { align: 'right' });

        // --- Client Info (Left Side) ---
        doc.setTextColor(30, 41, 59);
        const startY = 25; // Aligning with the logo roughly
        const lineSpacing = 6;
        const leftCol = 20;
        const leftVal = 46; // Indentation for the value

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(`CLIENTE:`, leftCol, startY);
        doc.setFont('helvetica', 'normal');
        doc.text((quote.client || '').toUpperCase(), leftVal, startY);

        doc.setFont('helvetica', 'bold');
        doc.text(`EVENTO:`, leftCol, startY + lineSpacing);
        doc.setFont('helvetica', 'normal');
        doc.text((quote.eventName || '').toUpperCase(), leftVal, startY + lineSpacing);

        doc.setFont('helvetica', 'bold');
        doc.text(`LOCACIÓN:`, leftCol, startY + lineSpacing * 2);
        doc.setFont('helvetica', 'normal');
        doc.text((quote.location || '').toUpperCase(), leftVal, startY + lineSpacing * 2);

        doc.setFont('helvetica', 'bold');
        doc.text(`MONTAJE:`, leftCol, startY + lineSpacing * 3);
        doc.setFont('helvetica', 'normal');
        doc.text(formatDateWithDay(quote.timing?.montaje || '').toUpperCase(), leftVal, startY + lineSpacing * 3);

        doc.setFont('helvetica', 'bold');
        doc.text(`FECHA:`, leftCol, startY + lineSpacing * 4);
        doc.setFont('helvetica', 'normal');
        doc.text(formatDateWithDay(quote.eventDate || quote.event_date || ''), leftVal, startY + lineSpacing * 4);

        doc.setFont('helvetica', 'bold');
        doc.text(`DESMONTAJE:`, leftCol, startY + lineSpacing * 5);
        doc.setFont('helvetica', 'normal');
        doc.text(formatDateWithDay(quote.timing?.desmontaje || '').toUpperCase(), leftVal, startY + lineSpacing * 5);

        doc.setFont('helvetica', 'bold');
        doc.text(`TELÉFONO:`, leftCol, startY + lineSpacing * 6);
        doc.setFont('helvetica', 'normal');
        doc.text((quote.timing?.contactPhone || '').toUpperCase(), leftVal, startY + lineSpacing * 6);

        // Divider Line
        doc.setDrawColor(30, 41, 59);
        doc.setLineWidth(0.5);
        doc.line(20, startY + lineSpacing * 6 + 6, 190, startY + lineSpacing * 6 + 6);

        // --- Tables ---
        let currentY = startY + lineSpacing * 6 + 16;

        const sections = [
            { title: 'LOUNGE', items: (quote.items.lounge || []).filter(i => i.name?.trim() && i.cant > 0) },
            { title: 'ACCESORIOS', items: (quote.items.accesorios || []).filter(i => i.name?.trim() && i.cant > 0) },
            { title: 'DECO', items: (quote.items.deco || []).filter(i => i.name?.trim() && i.cant > 0) },
            { title: 'EXTRAS', items: (quote.items.extras || quote.items.otros || []).filter(i => i.name?.trim() && i.cant > 0) },
            { title: 'LOGÍSTICA', items: (quote.items.logistica || []).filter(i => i.name?.trim() && i.cant > 0) }
        ];

        sections.forEach(section => {
            if (section.items.length > 0) {
                // Section Title
                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(100, 116, 139); // Slate 500
                doc.text(section.title, 20, currentY);
                currentY += 1;

                // Section Table
                autoTable(doc, {
                    startY: currentY,
                    head: [isLogistics ? ['Descripción', 'Cant', 'Días'] : ['Descripción', 'Cant', 'Días', 'Valor Unit', 'Total']],
                    body: section.items.map(item => {
                        const desc = item.observation ? `${item.name}\n${item.observation}` : item.name;
                        return isLogistics
                            ? [desc, item.cant, item.days]
                            : [desc, item.cant, item.days, `$${item.unit.toLocaleString('es-CL')}`, `$${item.total.toLocaleString('es-CL')}`];
                    }),
                    theme: 'grid',
                    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' },
                    styles: { fontSize: 8, cellPadding: 2 },
                    columnStyles: isLogistics ? {
                        0: { cellWidth: 130 }
                    } : {
                        0: { cellWidth: 80 },
                        3: { halign: 'right' },
                        4: { halign: 'right' }
                    }
                });

                currentY = doc.lastAutoTable.finalY + 6;
            }
        });

        // --- Totals ---
        const finalY = currentY + 3;

        if (!isLogistics) {
            // --- Totals ---
            // Calculate raw total before discount manually
            let rawSubtotal = 0;
            Object.values(quote.items).forEach(category => {
                if (Array.isArray(category)) {
                    category.forEach(item => {
                        rawSubtotal += item.total || 0;
                    });
                }
            });

            const discountPercentage = quote.discount_percentage || quote.discountPercentage || 0;
            const discountAmount = Math.round(rawSubtotal * (discountPercentage / 100));
            const net = rawSubtotal - discountAmount;
            const iva = Math.round(net * 0.19);
            const total = Math.round(net * 1.19);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');

            let currentTotalY = finalY;

            if (discountPercentage > 0) {
                doc.text(`SUBTOTAL:`, 150, currentTotalY, { align: 'right' });
                doc.text(`$${rawSubtotal.toLocaleString('es-CL')}`, 190, currentTotalY, { align: 'right' });
                currentTotalY += 4;

                doc.setTextColor(220, 38, 38); // Red for discount
                doc.text(`DESCUENTO (${discountPercentage}%):`, 150, currentTotalY, { align: 'right' });
                // We show it without the minus sign so JS PDF 'right' align aligns the numbers perfectly with the rest of the column.
                doc.text(`$${discountAmount.toLocaleString('es-CL')}`, 190, currentTotalY, { align: 'right' });
                doc.setTextColor(30, 41, 59); // Back to Slate 800
                currentTotalY += 4;
            }

            doc.text(`NETO:`, 150, currentTotalY, { align: 'right' });
            doc.text(`$${net.toLocaleString('es-CL')}`, 190, currentTotalY, { align: 'right' });

            doc.text(`IVA (19%):`, 150, currentTotalY + 4, { align: 'right' });
            doc.text(`$${iva.toLocaleString('es-CL')}`, 190, currentTotalY + 4, { align: 'right' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(`TOTAL:`, 150, currentTotalY + 10, { align: 'right' });
            doc.text(`$${total.toLocaleString('es-CL')}`, 190, currentTotalY + 10, { align: 'right' });

            // --- Footer ---
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setFillColor(254, 249, 195); // Yellow
            doc.rect(20, currentTotalY + 18, 170, 10, 'F');
            doc.setTextColor(133, 77, 14); // Dark Yellow/Brown
            doc.text('Mobiliario a elección y sujeto a disponibilidad.', 105, currentTotalY + 22.5, { align: 'center' });
            doc.text('Cotización válida por 7 días.', 105, currentTotalY + 26.5, { align: 'center' });

            // A CONSIDERAR Section
            let considerY = currentTotalY + 35;
            doc.setTextColor(0, 0, 0); // Pure Black
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10); // ~13px equivalent in jsPDF points
            doc.text('A CONSIDERAR:', 20, considerY);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9); // ~12px equivalent in jsPDF points
            const considerLines = [
                '* Se reserva cancelando el 50% del valor total y el 50% restante se debe cancelar 5 días antes del día del evento.',
                '* En caso de suspensión del evento, es necesario avisar con 1 mes de anticipación al evento y con eso se hará la devolución del 50%.',
                '* En caso de suspensión y no cumplir con el plazo mencionado anteriormente, se devolverá el 40% de lo pagado por gastos internos y suspensión de otros eventos.'
            ];

            considerLines.forEach((line, i) => {
                const splitLine = doc.splitTextToSize(line, 170);
                doc.text(splitLine, 20, considerY + 5 + (i * 6));
                considerY += (splitLine.length - 1) * 4; // Adjust for wrapped lines
            });
        } else {
            // Logistics Footer (Notes)
            if (logisticsNote) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0);
                doc.text('NOTAS LOGÍSTICAS:', 20, finalY + 10);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(71, 85, 105);
                const splitNote = doc.splitTextToSize(logisticsNote, 170);
                doc.text(splitNote, 20, finalY + 16);
            }
        }

        // Save
        doc.save(isLogistics ? `Logistica_${quote.id}_${quote.client.replace(/ /g, '_')}.pdf` : `Cotizacion_${quote.id}_${quote.client.replace(/ /g, '_')}.pdf`);
    };





    // File Upload Handler
    const handleFileUpload = async (e, quoteId, type) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            // 1. Upload to Supabase Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${quoteId}/${type}_${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('quote_attachments')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('quote_attachments')
                .getPublicUrl(fileName);

            // 3. Update Quote Record
            let updateData = {};

            if (type === 'invoice') {
                updateData = { invoice_url: publicUrl };
            } else {
                // Fetch current voucher_urls to append
                const { data: currentQuote } = await supabase
                    .from('quotes')
                    .select('voucher_urls, voucher_url')
                    .eq('id', quoteId)
                    .single();

                // Initialize array if needed, including migration from old column if present
                let currentUrls = currentQuote.voucher_urls || [];
                if (currentUrls.length === 0 && currentQuote.voucher_url) {
                    currentUrls = [currentQuote.voucher_url];
                }

                updateData = { voucher_urls: [...currentUrls, publicUrl] };
            }

            const { error: dbError } = await supabase
                .from('quotes')
                .update(updateData)
                .eq('id', quoteId);

            if (dbError) throw dbError;

            // 4. Update Local State
            const updatedQuotes = quotes.map(q => {
                if (q.id !== quoteId) return q;

                if (type === 'invoice') {
                    return { ...q, invoiceUrl: publicUrl };
                } else {
                    const oldUrls = q.voucherUrls || (q.voucherUrl ? [q.voucherUrl] : []);
                    return { ...q, voucherUrls: [...oldUrls, publicUrl], voucherUrl: publicUrl }; // keep voucherUrl for safety
                }
            });

            setQuotes(updatedQuotes);

            // Update selected quote if it's currently open
            if (selectedQuote && selectedQuote.id === quoteId) {
                if (type === 'invoice') {
                    setSelectedQuote({ ...selectedQuote, invoiceUrl: publicUrl });
                } else {
                    const oldUrls = selectedQuote.voucherUrls || (selectedQuote.voucherUrl ? [selectedQuote.voucherUrl] : []);
                    setSelectedQuote({ ...selectedQuote, voucherUrls: [...oldUrls, publicUrl], voucherUrl: publicUrl });
                }
            }

            alert(`${type === 'invoice' ? 'Factura' : 'Comprobante'} subido correctamente`);

        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Error al subir archivo');
        }
    };

    const handleDeleteVoucher = async (quoteId, urlToDelete) => {
        if (!confirm('¿Estás seguro de eliminar este comprobante?')) return;

        try {
            // 1. Fetch current URLs
            const { data: currentQuote, error: fetchError } = await supabase
                .from('quotes')
                .select('voucher_urls, voucher_url')
                .eq('id', quoteId)
                .single();

            if (fetchError) throw fetchError;

            // 2. Filter out the URL
            let currentUrls = currentQuote.voucher_urls || [];
            if (currentUrls.length === 0 && currentQuote.voucher_url) {
                currentUrls = [currentQuote.voucher_url];
            }

            const newUrls = currentUrls.filter(u => u !== urlToDelete);
            // Fallback for single legacy url if it matches newUrls[0] or null
            const newLegacyUrl = newUrls.length > 0 ? newUrls[0] : null;

            // 3. Update DB
            const { error: updateError } = await supabase
                .from('quotes')
                .update({
                    voucher_urls: newUrls,
                    voucher_url: newLegacyUrl
                })
                .eq('id', quoteId);

            if (updateError) throw updateError;

            // 4. Update Local State
            const updatedQuotes = quotes.map(q => {
                if (q.id !== quoteId) return q;
                return { ...q, voucherUrls: newUrls, voucherUrl: newLegacyUrl };
            });

            setQuotes(updatedQuotes);

            // Update selected quote if it's currently open
            if (selectedQuote && selectedQuote.id === quoteId) {
                setSelectedQuote({ ...selectedQuote, voucherUrls: newUrls, voucherUrl: newLegacyUrl });
            }

        } catch (error) {
            console.error('Error deleting voucher:', error);
            alert('Error al eliminar comprobante');
        }
    };

    const handleDeleteQuote = async (e, quoteId) => {
        if (e) e.stopPropagation();
        console.log('Delete button clicked for quote:', quoteId);

        const password = prompt(`Para eliminar la cotización #${quoteId}, ingrese la contraseña de administrador:`);

        if (!password) return; // User cancelled

        if (password === 'admin123') {
            try {
                // Find quote to be deleted
                const quoteToDelete = quotes.find(q => q.id === quoteId);
                console.log('Quote found for deletion:', quoteToDelete?.id);

                console.log('Executing delete in Supabase for ID:', quoteId);
                const { error } = await supabase.from('quotes').delete().eq('id', quoteId);
                if (error) {
                    console.error('Supabase delete error:', error);
                    throw error;
                }
                console.log('Quote deleted from Supabase successfully.');

                setQuotes(quotes.filter(q => q.id !== quoteId));
                fetchInventory(); // Refresh local DB snapshot
                setShowToast('Cotización eliminada correctamente.');

                if (selectedQuote && selectedQuote.id === quoteId) {
                    setSelectedQuote(null);
                    setView('list');
                }
            } catch (error) {
                console.error('Fatal error in handleDeleteQuote:', error);
                alert('Error al eliminar la cotización: ' + error.message);
            }
        } else {
            alert('Contraseña incorrecta. No se puede eliminar la cotización.');
        }
    };



    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="className-wrapper"
        >
            <div className="module-header flex justify-between items-end mb-10">
                <div>
                    <h1 className="text-3xl font-black">Cotizaciones</h1>
                    <p className="text-slate-500 font-medium tracking-tight">Gestión de presupuestos y facturación</p>
                </div>
                {view === 'list' && (
                    <button
                        onClick={() => setView('create')}
                        className="flex items-center gap-3 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/30 transition-all border-none"
                    >
                        <Plus size={20} strokeWidth={3} /> <span className="text-base">Crear Cotización</span>
                    </button>
                )}

            </div>

            <AnimatePresence>
                {toastConfig.show && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700/50"
                    >
                        <div className="bg-emerald-500 rounded-full p-1">
                            <Check size={14} className="text-slate-900 stroke-[3]" />
                        </div>
                        <span className="font-bold text-sm">{toastConfig.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
                {view === 'list' && (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="flex flex-col gap-6"
                    >
                        {/* Filters Panel */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm mb-6">
                            <div className="flex flex-wrap gap-4 items-end">
                                <div className="flex-[2] min-w-[200px]">
                                    <label className="label-field text-[0.65rem] font-black uppercase tracking-widest text-slate-400 mb-2 block">Buscar Cotización</label>
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Nombre de cliente, ID o evento..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="input-field h-[42px] text-xs bg-slate-50 border-none pl-10 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="min-w-[120px]">
                                    <label className="label-field text-[0.65rem] font-black uppercase tracking-widest text-slate-400 mb-2 block">Filtrar por Año</label>
                                    <div className="relative group">
                                        <select
                                            value={mainFilterInput.year}
                                            onChange={(e) => handleFilterChange(e, 'year')}
                                            className="w-full h-[42px] bg-blue-600 text-white border-none px-5 pr-10 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all appearance-none outline-none"
                                        >
                                            <option value="" className="bg-white text-slate-900">Todos</option>
                                            <option value="2024" className="bg-white text-slate-900">2024</option>
                                            <option value="2025" className="bg-white text-slate-900">2025</option>
                                            <option value="2026" className="bg-white text-slate-900">2026</option>
                                            <option value="2027" className="bg-white text-slate-900">2027</option>
                                            <option value="2028" className="bg-white text-slate-900">2028</option>
                                            <option value="2029" className="bg-white text-slate-900">2029</option>
                                            <option value="2030" className="bg-white text-slate-900">2030</option>
                                        </select>
                                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white pointer-events-none group-hover:scale-110 transition-transform" strokeWidth={3} />
                                    </div>
                                </div>

                                <div className="min-w-[180px]">
                                    <label className="label-field text-[0.65rem] font-black uppercase tracking-widest text-slate-400 mb-2 block">Filtrar por Mes</label>
                                    <div className="relative group">
                                        <select
                                            value={mainFilterInput.month}
                                            onChange={(e) => handleFilterChange(e, 'month')}
                                            className="w-full h-[42px] bg-blue-600 text-white border-none px-5 pr-10 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 transition-all appearance-none outline-none"
                                        >
                                            <option value="" className="bg-white text-slate-900">Todos los Meses</option>
                                            <option value="01" className="bg-white text-slate-900">Enero</option>
                                            <option value="02" className="bg-white text-slate-900">Febrero</option>
                                            <option value="03" className="bg-white text-slate-900">Marzo</option>
                                            <option value="04" className="bg-white text-slate-900">Abril</option>
                                            <option value="05" className="bg-white text-slate-900">Mayo</option>
                                            <option value="06" className="bg-white text-slate-900">Junio</option>
                                            <option value="07" className="bg-white text-slate-900">Julio</option>
                                            <option value="08" className="bg-white text-slate-900">Agosto</option>
                                            <option value="09" className="bg-white text-slate-900">Septiembre</option>
                                            <option value="10" className="bg-white text-slate-900">Octubre</option>
                                            <option value="11" className="bg-white text-slate-900">Noviembre</option>
                                            <option value="12" className="bg-white text-slate-900">Diciembre</option>
                                        </select>
                                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-white pointer-events-none group-hover:scale-110 transition-transform" strokeWidth={3} />
                                    </div>
                                </div>

                                <div className="min-w-[140px]">
                                    <label className="label-field text-[0.65rem] font-black uppercase tracking-widest text-slate-400 mb-2 block">Estado</label>
                                    <select
                                        value={mainFilterInput.status}
                                        onChange={(e) => handleFilterChange(e, 'status')}
                                        className="w-full h-[42px] bg-slate-50 border-none px-4 rounded-xl text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-all appearance-none"
                                    >
                                        <option value="Todas">Todas</option>
                                        <option value="Borrador">Borrador</option>
                                        <option value="Enviada">Enviada</option>
                                        <option value="Aceptada">Aceptada</option>
                                        <option value="No Aceptada">No Aceptada</option>
                                    </select>
                                </div>

                                <div className="min-w-[140px]">
                                    <label className="label-field text-[0.65rem] font-black uppercase tracking-widest text-slate-400 mb-2 block">Desde</label>
                                    <input
                                        type="date"
                                        value={mainFilterInput.start}
                                        onChange={(e) => handleFilterChange(e, 'start')}
                                        className="w-full h-[42px] bg-slate-50 border-none px-4 rounded-xl text-xs font-bold text-slate-700"
                                    />
                                </div>

                                <div className="min-w-[140px]">
                                    <label className="label-field text-[0.65rem] font-black uppercase tracking-widest text-slate-400 mb-2 block">Hasta</label>
                                    <input
                                        type="date"
                                        value={mainFilterInput.end}
                                        onChange={(e) => handleFilterChange(e, 'end')}
                                        className="w-full h-[42px] bg-slate-50 border-none px-4 rounded-xl text-xs font-bold text-slate-700"
                                    />
                                </div>

                                <button
                                    onClick={applyFilters}
                                    className="h-[42px] px-8 bg-slate-900 text-white font-black text-xs rounded-xl hover:bg-blue-600 shadow-xl shadow-slate-900/10 hover:shadow-blue-500/30 transition-all flex items-center justify-center active:scale-95 whitespace-nowrap uppercase tracking-widest"
                                >
                                    Aplicar Filtros
                                </button>
                            </div>
                        </div>

                        <div className="card overflow-hidden shadow-flat" style={{ padding: '0', border: 'none' }}>
                            <table className="data-table w-full">
                                <thead>
                                    <tr className="text-left bg-slate-50/50 border-b border-slate-100">
                                        <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest w-[100px]">NÚMERO</th>
                                        <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">CLIENTE / EVENTO</th>
                                        <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest w-[200px]">FECHAS (EVENTO / PAGO)</th>
                                        <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest w-[150px]">LOCACIÓN</th>
                                        <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest w-[120px]">TOTAL</th>
                                        <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest w-[140px]">ESTADO</th>
                                        <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest text-right w-[180px]">ACCIONES</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredQuotes.map(q => (
                                        <tr
                                            key={q.id}
                                            className={`group border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-all cursor-pointer ${getRowHighlightClass(q)}`}
                                            onClick={() => { setSelectedQuote(q); setView('preview'); }}
                                        >
                                            <td className="py-6 px-8 font-black text-blue-600">#{q.id}</td>
                                            <td className="py-6 px-8">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-700 text-sm">{q.client}</span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[0.6rem] font-bold uppercase tracking-wide border ${q.clientType === 'Productora' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                                            q.clientType === 'Empresa' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                                'bg-slate-50 text-slate-500 border-slate-200'
                                                            }`}>{q.clientType || 'N/A'}</span>
                                                    </div>
                                                    <span className="text-xs text-slate-400 font-medium">{q.eventName || 'Sin nombre de evento'}</span>
                                                </div>
                                            </td>
                                            <td className="py-6 px-8">
                                                <div className="date-cell-container">
                                                    {/* Event Date */}
                                                    <div className="date-input-wrapper group">
                                                        <div className="date-icon text-blue-500">
                                                            <Calendar size={14} strokeWidth={2.5} />
                                                        </div>
                                                        <span className="date-input-text">
                                                            {formatDateWithDay(q.timing?.event_date_full || q.eventDate || q.event_date) || 'Sin fecha'}
                                                        </span>
                                                        <input
                                                            type="text"
                                                            defaultValue={q.timing?.event_date_full || q.eventDate || q.event_date || ''}
                                                            onBlur={(e) => handleEventDateChange(e, q.id)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="date-input-overlay"
                                                            title="Clic para editar fecha y hora"
                                                        />
                                                    </div>

                                                    {/* Payment Date */}
                                                    <div className="date-input-wrapper group">
                                                        <div className="date-icon text-emerald-500">
                                                            <DollarSign size={14} strokeWidth={2.5} />
                                                        </div>
                                                        <span className="date-input-text">
                                                            {formatDateWithDay(q.paymentDate || q.payment_date) || 'Pendiente de pago'}
                                                        </span>
                                                        <input
                                                            type="date"
                                                            value={q.paymentDate || q.payment_date || ''}
                                                            onChange={(e) => handlePaymentDateChange(e, q.id)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="date-input-overlay"
                                                            title="Clic para editar fecha de pago"
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="text-xs font-medium text-slate-600">{q.location || 'N/A'}</span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex flex-col">
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="font-bold text-slate-700">${Math.round(calculateTotal(q) * 1.19).toLocaleString()}</span>
                                                        <span className="text-[0.6rem] text-slate-400 font-bold uppercase tracking-tight">CON IVA</span>
                                                    </div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-xs font-semibold text-slate-500">${(q.total || 0).toLocaleString()}</span>
                                                        <span className="text-[0.6rem] text-slate-400 font-bold uppercase tracking-tight">SIN IVA</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex flex-col gap-2">
                                                    {/* Quote Status */}
                                                    <div className="relative inline-block w-full">
                                                        <select
                                                            value={q.status}
                                                            onChange={(e) => handleStatusChange(e, q.id)}
                                                            className={`appearance-none w-full pl-3 pr-8 text-center py-1.5 rounded-lg text-xs font-bold border-none outline-none cursor-pointer transition-all ${q.status === 'Aceptada' ? 'bg-indigo-100/50 text-indigo-700 hover:bg-indigo-100' :
                                                                q.status === 'Enviada' ? 'bg-blue-100/50 text-blue-700 hover:bg-blue-100' :
                                                                    q.status === 'No Aceptada' ? 'bg-red-100/50 text-red-700 hover:bg-red-100' :
                                                                        'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                                }`}
                                                        >
                                                            <option value="Borrador">Borrador</option>
                                                            <option value="Enviada">Enviada</option>
                                                            <option value="Aceptada">Aceptada</option>
                                                            <option value="No Aceptada">No Aceptada</option>
                                                        </select>
                                                        {q.status === 'Aceptada' && (
                                                            <Star
                                                                size={14}
                                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-500 pointer-events-none"
                                                                fill="#eab308"
                                                                stroke="none"
                                                            />
                                                        )}
                                                    </div>

                                                    {/* Payment Status */}
                                                    <select
                                                        value={q.paymentStatus || 'Impaga'}
                                                        onChange={(e) => handlePaymentStatusChange(e, q.id)}
                                                        className="appearance-none pl-3 pr-3 text-center py-1.5 rounded-lg text-xs font-bold border-none outline-none cursor-pointer transition-all"
                                                        style={{
                                                            backgroundColor: q.paymentStatus === 'Pagada' ? '#dcfce7' : q.paymentStatus === 'Pago Parcial' ? '#ffedd5' : '#fee2e2',
                                                            color: q.paymentStatus === 'Pagada' ? '#15803d' : q.paymentStatus === 'Pago Parcial' ? '#c2410c' : '#b91c1c'
                                                        }}
                                                    >
                                                        <option value="Impaga">Impaga</option>
                                                        <option value="Pago Parcial">Pago Parcial</option>
                                                        <option value="Pagada">Pagada</option>
                                                    </select>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex justify-end items-center gap-2">
                                                    {/* Invoice Actions */}
                                                    <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                                                        {q.invoiceUrl && (
                                                            <a
                                                                href={q.invoiceUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-1.5 text-blue-600 hover:bg-white rounded-md transition-all shadow-sm"
                                                                title="Ver Factura"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <Eye size={14} />
                                                            </a>
                                                        )}
                                                        <label className={`cursor-pointer flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-all ${q.invoiceUrl ? 'text-blue-600 hover:bg-white' : 'text-slate-500 hover:text-blue-600 hover:bg-white'}`} title={q.invoiceUrl ? "Reemplazar Factura" : "Subir Factura"}>
                                                            <input type="file" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, q.id, 'invoice')} accept=".pdf,.png,.jpg,.jpeg" />
                                                            {q.invoiceUrl ? <Upload size={14} /> : <FileText size={14} />}
                                                        </label>
                                                    </div>

                                                    {/* Voucher Actions */}
                                                    <div className="flex bg-emerald-50 rounded-lg p-1 gap-1 border border-emerald-100">
                                                        <label className="cursor-pointer flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-all text-emerald-700 hover:bg-white shadow-sm" title="Subir Voucher">
                                                            <input type="file" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, q.id, 'voucher')} accept=".pdf,.png,.jpg,.jpeg" />
                                                            {(q.voucherUrls?.length > 0 || q.voucherUrl) ? <Plus size={14} strokeWidth={3} /> : <Upload size={14} />}
                                                        </label>
                                                    </div>

                                                    <div className="flex bg-slate-100 rounded-lg p-1 ml-2">
                                                        <button
                                                            onClick={(e) => handleDeleteQuote(e, q.id)}
                                                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                                                            title="Eliminar Cotización"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>

                                                    <button
                                                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white rounded-lg font-bold text-xs transition-all whitespace-nowrap ml-1"
                                                        onClick={(e) => { e.stopPropagation(); setSelectedQuote(q); setView('preview'); }}
                                                        title="Vista Cliente"
                                                    >
                                                        <Eye size={14} /> Ver
                                                    </button>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); sendWhatsAppNotification(q); }}
                                                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors ml-1"
                                                        title="Notificar a Cliente"
                                                    >
                                                        <MessageCircle size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {(view === 'create' || view === 'edit') && (
                    <QuoteForm
                        clientDatabase={clientDatabase}
                        inventoryDatabase={inventoryDatabase}
                        events={events}
                        setEvents={setEvents}
                        setQuotes={setQuotes}
                        quotes={quotes}
                        setShowToast={setShowToast}
                        setView={setView}
                        fetchInventory={fetchInventory}
                        editingQuote={view === 'edit' ? selectedQuote : null}
                        onSave={() => {
                            // The save logic is now inside QuoteForm's handleSaveQuote calling setQuotes directly
                        }}
                        onCancel={() => setView('list')}
                    />
                )}

                {(view === 'preview' || view === 'logistics') && (
                    <motion.div
                        key="preview"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="preview-view"
                    >
                        <div className="preview-controls flex justify-between items-center w-full max-w-[210mm] bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-premium border border-white/20">
                            <button
                                onClick={() => setView('list')}
                                className="px-4 py-2 font-bold text-slate-400 hover:text-slate-900 transition-all flex items-center gap-2"
                            >
                                <span>←</span> Volver
                            </button>
                            <div className="flex gap-3">
                                <button
                                    className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md whitespace-nowrap ${view === 'logistics' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                    onClick={() => setView(view === 'preview' ? 'logistics' : 'preview')}
                                >
                                    {view === 'preview' ? 'Ver Modo Logística' : 'Volver a Vista Cliente'}
                                </button>
                                <button
                                    onClick={() => setView('edit')}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-all shadow-md whitespace-nowrap"
                                >
                                    <Pencil size={18} /> <span>Editar Cotización</span>
                                </button>
                                <button
                                    onClick={() => generateQuotePDF(selectedQuote, view === 'logistics')}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md whitespace-nowrap"
                                >
                                    <Download size={18} /> <span>Descargar PDF</span>
                                </button>
                            </div>
                        </div>
                        <div className="preview-paper-container shadow-2xl">
                            {/* Pass handlers to RenderModel if needed, or implement UI there */}
                            <RenderPuntoUrbanoModel
                                quote={selectedQuote}
                                showPrices={view === 'preview'}
                                logisticsNote={logisticsNote}
                                setLogisticsNote={setLogisticsNote}
                                handleSaveLogisticsNote={handleSaveLogisticsNote}
                                handleFileUpload={handleFileUpload}
                                handleDeleteVoucher={handleDeleteVoucher}
                            />

                            {/* Injecting Upload UI into the Preview (outside the paper or inside?) 
                                 The original UI had it inside RenderPuntoUrbanoModel at the bottom (lines 294+).
                                 We need to update RenderPuntoUrbanoModel definition above to include the logic or valid handlers.
                                 Since RenderPuntoUrbanoModel is defined ABOVE, this replacement won't touch it.
                                 I need to use MULTI-REPLACE or ensure I edit that section too.
                                 Actually, I should have included RenderPuntoUrbanoModel in the replacement if I wanted to fix it there.
                                 Wait, the replacement starts at handleFileUpload (new) and goes to end.
                                 RenderPuntoUrbanoModel is BEFORE the QuoteEngine component? No, it's INSIDE QuoteEngine (line 198).
                                 So I DO need to update RenderPuntoUrbanoModel.
                             */}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Action Button (FAB) */}
            {view === 'list' && (
                <div className="fab-container no-print">
                    <AnimatePresence>
                        {showFabOptions && (
                            <motion.div
                                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                                className="fab-options"
                            >
                                <button
                                    onClick={() => setHighlightMode(highlightMode === 'impagos' ? null : 'impagos')}
                                    className={`fab-option-btn unpaid ${highlightMode === 'impagos' ? 'active' : ''}`}
                                >
                                    <Clock size={16} /> Impagos
                                </button>
                                <button
                                    onClick={() => setHighlightMode(highlightMode === 'pagados' ? null : 'pagados')}
                                    className={`fab-option-btn paid ${highlightMode === 'pagados' ? 'active' : ''}`}
                                >
                                    <DollarSign size={16} /> Pagados
                                </button>
                                <button
                                    onClick={() => setHighlightMode(highlightMode === 'proximos' ? null : 'proximos')}
                                    className={`fab-option-btn upcoming ${highlightMode === 'proximos' ? 'active' : ''}`}
                                >
                                    <Calendar size={16} /> Próximos
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <button
                        onClick={() => setShowFabOptions(!showFabOptions)}
                        className="fab-main-btn"
                        title="Opciones de resaltado"
                    >
                        <Filter size={24} />
                    </button>
                </div>
            )}
        </motion.div>
    );
};



export default QuoteEngine;
