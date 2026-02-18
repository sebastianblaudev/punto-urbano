import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Download, Truck, Plus, Eye, Trash2, ArrowRight, Check, ChevronDown, Search, Calendar, FileText, MessageCircle, Upload, DollarSign, Filter, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COBRANZA_PHONE = '56912345678'; // NÚMERO DE COBRANZA (DEFINIDO)


const QuoteEngine = ({ quotes, setQuotes, events, setEvents }) => {
    const [view, setView] = useState('list');
    const [selectedQuote, setSelectedQuote] = useState(null);
    const [showToast, setShowToast] = useState(false);

    // Filters
    const [filterDateRange, setFilterDateRange] = useState({ start: '', end: '' });
    const [searchTerm, setSearchTerm] = useState('');

    const [clientDatabase, setClientDatabase] = useState([]);

    useEffect(() => {
        const fetchClients = async () => {
            const { data, error } = await supabase.from('clients').select('*');
            if (!error && data) {
                setClientDatabase(data);
            }
        };
        fetchClients();
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

                if (quoteToApprove && quoteToApprove.eventDate) {
                    const newEvent = {
                        date: quoteToApprove.eventDate,
                        title: quoteToApprove.eventNotes || `${quoteToApprove.eventName || 'Evento'} - ${quoteToApprove.client}`,
                        type: 'note',
                        description: `Evento: ${quoteToApprove.eventName || 'N/A'} - Cliente: ${quoteToApprove.client}`,
                        time: '09:00 AM'
                    };

                    const { data: eventData, error: eventError } = await supabase.from('events').insert([newEvent]).select();

                    if (!eventError && eventData) {
                        setEvents([...events, ...eventData]);
                    }
                }

                setShowToast(true);
                setTimeout(() => setShowToast(false), 3000);
            }
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Error al actualizar estado');
        }
    };

    const handlePaymentDateChange = async (e, quoteId) => {
        e.stopPropagation();
        const newDate = e.target.value;
        try {
            const { error } = await supabase.from('quotes').update({ payment_date: newDate }).eq('id', quoteId);
            if (error) throw error;
            setQuotes(quotes.map(q => q.id === quoteId ? { ...q, paymentDate: newDate } : q));
        } catch (error) {
            console.error('Error updating payment date:', error);
            alert('Error al actualizar fecha de pago');
        }
    };

    const handleFilterChange = (e, type) => {
        setFilterDateRange({ ...filterDateRange, [type]: e.target.value });
    };

    // Filter Logic
    const filteredQuotes = quotes.filter(q => {
        const matchesSearch = q.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
            q.id.includes(searchTerm) ||
            (q.eventName && q.eventName.toLowerCase().includes(searchTerm.toLowerCase()));

        // Date range filter helper (mock implementation, assumes eventDate string format needs parsing or matches simple string)
        // For production, parse dates properly using 'date-fns' or 'moment'
        // Here we just skip if empty
        const matchesDate = true;

        return matchesSearch && matchesDate;
    });

    const sendWhatsAppNotification = (quote) => {
        const message = `Hola Natalia, se ha generado/actualizado la cotización #${quote.id} para el cliente ${quote.client}. Por favor revisar.`;
        const url = `https://wa.me/56912345678?text=${encodeURIComponent(message)}`; // Replace with Natalia's number
        window.open(url, '_blank');
    };

    const generateQuotePDF = (quote) => {
        const doc = new jsPDF();

        // --- Header ---
        doc.setFillColor(30, 41, 59); // Slate 800
        doc.rect(0, 0, 210, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('PUNTOURBANO', 20, 20);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('SOLUCIONES PARA EVENTOS', 20, 26);

        doc.setFontSize(12);
        doc.text(`COTIZACIÓN N° ${quote.id}`, 190, 20, { align: 'right' });
        doc.text(new Date().toLocaleDateString('es-CL'), 190, 26, { align: 'right' });

        // --- Client Info ---
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('DATOS DEL CLIENTE', 20, 55);

        doc.setFont('helvetica', 'normal');
        doc.text(`Cliente:`, 20, 62);
        doc.text(quote.client, 60, 62);

        doc.text(`Evento:`, 20, 68);
        doc.text(quote.eventName || 'N/A', 60, 68);

        doc.text(`Locación:`, 20, 74);
        doc.text(quote.location || 'N/A', 60, 74);

        doc.text(`Fecha Evento:`, 120, 62);
        doc.text(quote.eventDate || 'N/A', 150, 62);

        // --- Tables ---
        let currentY = 85;

        const sections = [
            { title: 'ACCESORIOS', items: quote.items.accesorios },
            { title: 'OTROS', items: quote.items.otros },
            { title: 'LOGÍSTICA', items: quote.items.logistica }
        ];

        sections.forEach(section => {
            if (section.items.length > 0) {
                // Section Title
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(100, 116, 139); // Slate 500
                doc.text(section.title, 20, currentY);
                currentY += 2;

                // Section Table
                autoTable(doc, {
                    startY: currentY,
                    head: [['Descripción', 'Cant', 'Días', 'Valor Unit', 'Total']],
                    body: section.items.map(item => [
                        item.name,
                        item.cant,
                        item.days,
                        `$${item.unit.toLocaleString('es-CL')}`,
                        `$${item.total.toLocaleString('es-CL')}`
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' },
                    styles: { fontSize: 9, cellPadding: 3 },
                    columnStyles: {
                        0: { cellWidth: 80 },
                        3: { halign: 'right' },
                        4: { halign: 'right' }
                    }
                });

                currentY = doc.lastAutoTable.finalY + 10;
            }
        });

        // --- Totals ---
        const finalY = currentY + 5;
        const net = quote.total;
        const iva = Math.round(net * 0.19);
        const total = Math.round(net * 1.19);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`NETO:`, 150, finalY, { align: 'right' });
        doc.text(`$${net.toLocaleString('es-CL')}`, 190, finalY, { align: 'right' });

        doc.text(`IVA (19%):`, 150, finalY + 6, { align: 'right' });
        doc.text(`$${iva.toLocaleString('es-CL')}`, 190, finalY + 6, { align: 'right' });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`TOTAL:`, 150, finalY + 14, { align: 'right' });
        doc.text(`$${total.toLocaleString('es-CL')}`, 190, finalY + 14, { align: 'right' });

        // --- Footer ---
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150);
        doc.text('Condiciones: Pago del 50% para reserva. Saldo contra entrega.', 20, 280);

        // Save
        doc.save(`Cotizacion_${quote.id}_${quote.client.replace(/ /g, '_')}.pdf`);
    };

    const RenderPuntoUrbanoModel = ({ quote, showPrices = true }) => (
        <div className="punto-urbano-quote">
            <div className="quote-header">
                <div className="client-data text-left">
                    <p><strong>CLIENTE:</strong> {quote.client}</p>
                    <p><strong>EVENTO:</strong> {quote.eventName || 'N/A'}</p>
                    <p><strong>LOCACIÓN:</strong> {quote.location}</p>
                    <p><strong>MONTAJE:</strong> {quote.timing.montaje}</p>
                    <p><strong>FECHA:</strong> {quote.eventDate}</p>
                    <p><strong>DESMONTAJE:</strong> {quote.timing.desmontaje}</p>
                </div>
                <div className="brand-data">
                    <div className="logo-placeholder">
                        <div className="flex items-center gap-2 justify-end mb-1">
                            {/* Logo Icon Mock */}
                            <div className="w-6 h-6 bg-slate-900 rounded-md"></div>
                        </div>
                        <h1 className="text-right">PUNTOURBANO</h1>
                        <small className="text-right block">SOLUCIONES PARA EVENTOS</small>
                    </div>
                    <p className="quote-number text-right mt-2">N° PRESUPUESTO: {quote.id}</p>
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
                    <tr className="category-row text-left"><td colSpan={showPrices ? 5 : 3}>ACCESORIOS</td></tr>
                    {quote.items.accesorios.map((item, i) => (
                        <tr key={i}>
                            <td className="text-left">{item.name}</td>
                            <td style={{ textAlign: 'center' }}>{item.cant}</td>
                            <td style={{ textAlign: 'center' }}>{item.days}</td>
                            {showPrices && <><td style={{ textAlign: 'right' }}>${item.unit.toLocaleString()}</td><td style={{ textAlign: 'right' }}>${item.total.toLocaleString()}</td></>}
                        </tr>
                    ))}
                    <tr className="category-row text-left"><td colSpan={showPrices ? 5 : 3}>OTROS</td></tr>
                    {quote.items.otros.map((item, i) => (
                        <tr key={i}>
                            <td className="text-left">{item.name}</td>
                            <td style={{ textAlign: 'center' }}>{item.cant}</td>
                            <td style={{ textAlign: 'center' }}>{item.days}</td>
                            {showPrices && <><td style={{ textAlign: 'right' }}>${item.unit.toLocaleString()}</td><td style={{ textAlign: 'right' }}>${item.total.toLocaleString()}</td></>}
                        </tr>
                    ))}
                    <tr className="category-row text-left"><td colSpan={showPrices ? 5 : 3}>LOGÍSTICA</td></tr>
                    {quote.items.logistica.map((item, i) => (
                        <tr key={i}>
                            <td className="text-left">{item.name}</td>
                            <td style={{ textAlign: 'center' }}>{item.cant}</td>
                            <td style={{ textAlign: 'center' }}>{item.days}</td>
                            {showPrices && <><td style={{ textAlign: 'right' }}>${item.unit.toLocaleString()}</td><td style={{ textAlign: 'right' }}>${item.total.toLocaleString()}</td></>}
                        </tr>
                    ))}
                </tbody>
            </table>

            {showPrices ? (
                <div className="quote-footer">
                    <div className="terms-yellow">
                        Mobiliario a elección y sujeto a disponibilidad. Para reservar se debe cancelar el 50%.
                    </div>
                    <div className="totals-box">
                        <div className="total-row"><span>NETO:</span> <span>${quote.total.toLocaleString()}</span></div>
                        <div className="total-row"><span>IVA 19%:</span> <span>${Math.round(quote.total * 0.19).toLocaleString()}</span></div>
                        <div className="total-row grand-total"><span>TOTAL:</span> <span>${Math.round(quote.total * 1.19).toLocaleString()}</span></div>
                    </div>
                </div>
            ) : (
                <div className="logistics-footer">
                    {/* Contenido removido por solicitud del usuario */}
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
                        <div className={`border rounded-xl p-4 flex items-center justify-between transition-all ${quote.voucherUrl ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50 hover:border-blue-300'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${quote.voucherUrl ? 'bg-white text-emerald-600 shadow-sm' : 'bg-white text-slate-300'}`}>
                                    <Upload size={20} />
                                </div>
                                <div>
                                    <p className={`text-sm font-bold ${quote.voucherUrl ? 'text-emerald-900' : 'text-slate-500'}`}>Comprobante de Pago</p>
                                    <p className="text-xs text-slate-400">{quote.voucherUrl ? 'Documento disponible' : 'Pendiente de carga'}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {quote.voucherUrl && (
                                    <a href={quote.voucherUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white text-emerald-600 hover:text-emerald-700 hover:shadow-md rounded-lg transition-all" title="Ver Documento">
                                        <Eye size={18} />
                                    </a>
                                )}
                                <label className={`flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 ${quote.voucherUrl ? 'text-slate-500 hover:text-emerald-600 hover:border-emerald-300' : 'text-blue-600 hover:bg-blue-50 hover:border-blue-300'} hover:shadow-md rounded-lg cursor-pointer transition-all`} title={quote.voucherUrl ? "Reemplazar Archivo" : "Subir Archivo"}>
                                    <input type="file" style={{ display: "none" }} onChange={(e) => handleFileUpload(e, quote.id, 'voucher')} accept=".pdf,.png,.jpg,.jpeg" />
                                    <Upload size={16} />
                                    <span className="text-xs font-bold">{quote.voucherUrl ? 'Reemplazar' : 'Subir'}</span>
                                </label>
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
                </div>
            )}
        </div>
    );

    // Helper for input fields in the create form
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

    const QuoteForm = ({ onSave, onCancel, clientDatabase, events, setEvents }) => {
        const [newQuote, setNewQuote] = useState({
            client: '',
            clientType: '', // Added clientType
            location: '',
            eventDate: '',
            expirationDate: '', // FECHA DE CADUCIDAD
            eventName: '',
            eventNotes: '',
            items: {
                accesorios: [],
                otros: [],
                logistica: []
            },
            timing: {
                montaje: '',
                desmontaje: ''
            }
        });

        const [clientSuggestions, setClientSuggestions] = useState([]);
        const [showSuggestions, setShowSuggestions] = useState(false);

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
            setNewQuote({ ...newQuote, client: client.name, clientType: client.type });
            setShowSuggestions(false);
        };

        const handleAddItem = (category) => {
            setNewQuote({
                ...newQuote,
                items: {
                    ...newQuote.items,
                    [category]: [...newQuote.items[category], { name: '', cant: 1, days: 1, unit: 0, total: 0 }]
                }
            });
        };

        const handleItemChange = (category, index, field, value) => {
            const updatedItems = [...newQuote.items[category]];
            updatedItems[index][field] = value;
            if (field === 'cant' || field === 'days' || field === 'unit') {
                updatedItems[index].total = updatedItems[index].cant * updatedItems[index].days * updatedItems[index].unit;
            }
            setNewQuote({
                ...newQuote,
                items: {
                    ...newQuote.items,
                    [category]: updatedItems
                }
            });
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

        const calculateTotal = (quote) => {
            let total = 0;
            Object.values(quote.items).forEach(category => {
                category.forEach(item => {
                    total += item.total;
                });
            });
            return total;
        };

        const handleSaveQuote = async () => {
            const total = calculateTotal(newQuote);
            const quoteId = String(Math.floor(Math.random() * 10000));

            // Map to Supabase schema (snake_case)
            const quoteToSaveDB = {
                id: quoteId,
                client: newQuote.client,
                client_type: newQuote.clientType, // Using captured clientType
                location: newQuote.location,
                event_date: newQuote.eventDate,
                event_name: newQuote.eventName,
                total: total,
                total: total,
                status: 'Borrador',
                payment_date: null,
                expiration_date: newQuote.expirationDate, // GUARDAR EN DB
                items: newQuote.items,
                timing: newQuote.timing
            };

            // Object for local state (camelCase)
            const quoteToSaveLocal = {
                ...newQuote,
                id: quoteId,
                total: total,
                status: 'Borrador',
                paymentDate: ''
            };

            try {
                const { error: quoteError } = await supabase.from('quotes').insert([quoteToSaveDB]);
                if (quoteError) throw quoteError;



                onSave(quoteToSaveLocal);
            } catch (error) {
                console.error('Error saving quote:', error);

                if (error.message && (error.message.includes('JWT expired') || error.code === 'PGRST301')) {
                    alert('Tu sesión ha expirado. Por favor, recarga la página e inicia sesión nuevamente.');
                    // Optional: force logout if you have access to that function, or just reload
                    window.location.reload();
                } else {
                    alert('Error al guardar cotización: ' + error.message);
                }
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

                <div className="grid grid-cols-2 gap-6 mb-8">
                    <div className="relative">
                        <InputField
                            label="Cliente"
                            value={newQuote.client}
                            onChange={handleClientChange}
                            placeholder="Ej: Productora XYZ"
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        />
                        {showSuggestions && (
                            <div
                                className="absolute w-full left-0 top-full mt-2 rounded-xl shadow-2xl overflow-y-auto p-2"
                                style={{
                                    backgroundColor: '#ffffff',
                                    background: '#ffffff',
                                    opacity: 1,
                                    zIndex: 1000,
                                    border: '1px solid #e2e8f0',
                                    maxHeight: '250px'
                                }}
                            >
                                {clientSuggestions.length > 0 ? (
                                    clientSuggestions.map((client, idx) => (
                                        <div
                                            key={idx}
                                            className="px-5 py-3 hover:bg-blue-50 cursor-pointer flex flex-col border-b border-slate-50 last:border-none transition-colors rounded-lg mb-1 last:mb-0"
                                            onClick={() => selectClient(client)}
                                            style={{ backgroundColor: '#ffffff', background: '#ffffff' }}
                                        >
                                            <span className="font-bold text-sm text-slate-800">{client.name}</span>
                                            <span className="text-[0.7rem] text-slate-400 font-medium uppercase tracking-wider">{client.contact}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-5 py-4 text-slate-400 text-xs italic" style={{ backgroundColor: '#ffffff', background: '#ffffff' }}>No se encontraron clientes</div>
                                )}
                            </div>
                        )}
                    </div>
                    <InputField label="Nombre Evento" value={newQuote.eventName} onChange={(e) => setNewQuote({ ...newQuote, eventName: e.target.value })} placeholder="Ej: Lanzamiento Marca" />
                    <InputField label="Ubicación" value={newQuote.location} onChange={(e) => setNewQuote({ ...newQuote, location: e.target.value })} placeholder="Ej: Espacio Riesco" />
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Fecha Evento" type="date" value={newQuote.eventDate} onChange={(e) => setNewQuote({ ...newQuote, eventDate: e.target.value })} placeholder="Ej: 15 de Octubre" />
                        <InputField label="Fecha Caducidad" type="date" value={newQuote.expirationDate} onChange={(e) => setNewQuote({ ...newQuote, expirationDate: e.target.value })} placeholder="Vencimiento cotización" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Montaje" value={newQuote.timing.montaje} onChange={(e) => setNewQuote({ ...newQuote, timing: { ...newQuote.timing, montaje: e.target.value } })} placeholder="Fecha/Hora" />
                        <InputField label="Desmontaje" value={newQuote.timing.desmontaje} onChange={(e) => setNewQuote({ ...newQuote, timing: { ...newQuote.timing, desmontaje: e.target.value } })} placeholder="Fecha/Hora" />
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
                </div>


                <div className="space-y-10">
                    {['accesorios', 'otros', 'logistica'].map((category) => (
                        <div key={category} className="group relative">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-8 w-1 bg-blue-500 rounded-full"></div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">{category}</h3>
                            </div>

                            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 transition-all hover:bg-slate-50 hover:shadow-sm">
                                <div className="space-y-4">
                                    {newQuote.items[category].map((item, index) => (
                                        <div key={index} className="grid grid-cols-12 gap-4 items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="col-span-12 md:col-span-6">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block pl-1">Descripción</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ej: Silla Tiffany"
                                                    className="w-full input-field p-3 text-sm font-medium"
                                                    value={item.name}
                                                    onChange={(e) => handleItemChange(category, index, 'name', e.target.value)}
                                                />
                                            </div>
                                            <div className="col-span-3 md:col-span-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block text-center">Cant</label>
                                                <input
                                                    type="number"
                                                    className="w-full input-field p-3 text-sm font-bold text-center"
                                                    value={item.cant}
                                                    onChange={(e) => handleItemChange(category, index, 'cant', parseInt(e.target.value) || 0)}
                                                />
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
                                                        title="Eliminar ítem"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {newQuote.items[category].length === 0 && (
                                        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                                            <p className="text-slate-400 text-sm font-medium">No hay elementos en esta categoría</p>
                                        </div>
                                    )}
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

                <div className="mt-12 bg-slate-900 rounded-2xl p-8 text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 translate-y-1/2 -translate-x-1/2"></div>

                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="text-center md:text-left">
                            <p className="text-slate-400 text-sm font-medium mb-1">Resumen del Presupuesto</p>
                            <h3 className="text-2xl font-bold tracking-tight">Total Estimado</h3>
                        </div>
                        <div className="flex items-center gap-8">
                            <div className="text-right">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">NETO</p>
                                <p className="text-3xl font-black tracking-tight">${calculateTotal(newQuote).toLocaleString()}</p>
                            </div>
                            <div className="h-10 w-px bg-slate-700 hidden md:block"></div>
                            <button
                                onClick={handleSaveQuote}
                                className="px-8 py-4 bg-white text-slate-900 font-black rounded-xl hover:bg-blue-50 shadow-lg shadow-white/10 transition-all flex items-center gap-2 hover:scale-105 active:scale-95"
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
            const column = type === 'invoice' ? 'invoice_url' : 'voucher_url';
            const { error: dbError } = await supabase
                .from('quotes')
                .update({ [column]: publicUrl })
                .eq('id', quoteId);

            if (dbError) throw dbError;

            // 4. Update Local State
            const updatedQuotes = quotes.map(q =>
                q.id === quoteId ? { ...q, [type === 'invoice' ? 'invoiceUrl' : 'voucherUrl']: publicUrl } : q
            );
            setQuotes(updatedQuotes);

            // Update selected quote if it's currently open
            if (selectedQuote && selectedQuote.id === quoteId) {
                setSelectedQuote({ ...selectedQuote, [type === 'invoice' ? 'invoiceUrl' : 'voucherUrl']: publicUrl });
            }

            alert(`${type === 'invoice' ? 'Factura' : 'Comprobante'} subido correctamente`);

        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Error al subir archivo');
        }
    };

    const handleCheckExpirations = () => {
        const today = new Date().toISOString().split('T')[0];
        const expiringQuotes = quotes.filter(q => {
            const expDate = q.expiration_date || q.expirationDate;
            // Filter logic: Expiration date is today or in the past, and not paid/rejected
            // Also ensure it's not null
            return expDate && expDate <= today && q.status !== 'Pagada' && q.status !== 'Rechazada' && q.status !== 'Cerrada';
        });

        if (expiringQuotes.length === 0) {
            alert('No hay cotizaciones vencidas pendientes de pago.');
            return;
        }

        let message = `*REPORTE DE COBRANZA - ${new Date().toLocaleDateString('es-CL')}*\n`;
        message += `Se han detectado ${expiringQuotes.length} cotizaciones vencidas:\n\n`;

        expiringQuotes.forEach((q, index) => {
            message += `${index + 1}. *#${q.id}* - ${q.client}\n`;
            message += `   Vence: ${q.expiration_date || q.expirationDate}\n`;
            message += `   Monto: $${(q.total || 0).toLocaleString('es-CL')}\n`;
            // Add link to PDF if available?
            // if (q.invoiceUrl) message += `   Factura: ${q.invoiceUrl}\n`;
            message += `\n`;
        });

        message += `Favor gestionar pago.`;

        const url = `https://wa.me/${COBRANZA_PHONE}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
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
                {view === 'list' && (
                    <button
                        onClick={() => handleCheckExpirations()}
                        className="flex items-center gap-2 px-6 py-3 ml-2 bg-amber-100 text-amber-700 font-bold rounded-xl hover:bg-amber-200 transition-all border-none"
                    >
                        <Bell size={20} /> <span className="text-sm">Alertar Vencimientos</span>
                    </button>
                )}
            </div>

            <AnimatePresence>
                {showToast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700/50"
                    >
                        <div className="bg-emerald-500 rounded-full p-1">
                            <Check size={14} className="text-slate-900 stroke-[3]" />
                        </div>
                        <span className="font-bold text-sm">¡Éxito! Cotización aceptada.</span>
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
                        <div className="flex flex-row gap-6 items-end px-2 mb-2">
                            <div className="flex-[2] min-w-[250px]">
                                <label className="label-field text-[0.6rem] text-slate-400">Buscar</label>
                                <input
                                    type="text"
                                    placeholder="Cliente, ID, Evento..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="input-field h-[40px] text-xs bg-slate-100/50"
                                />
                            </div>
                            <div className="flex-1 min-w-[130px]">
                                <label className="label-field text-[0.6rem] text-slate-400">Desde</label>
                                <input
                                    type="date"
                                    value={filterDateRange.start}
                                    onChange={(e) => handleFilterChange(e, 'start')}
                                    className="input-field h-[40px] text-xs bg-slate-100/50"
                                />
                            </div>
                            <div className="flex-1 min-w-[130px]">
                                <label className="label-field text-[0.6rem] text-slate-400">Hasta</label>
                                <input
                                    type="date"
                                    value={filterDateRange.end}
                                    onChange={(e) => handleFilterChange(e, 'end')}
                                    className="input-field h-[40px] text-xs bg-slate-100/50"
                                />
                            </div>
                            <button className="h-[40px] px-6 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-blue-600 transition-all flex items-center justify-center active:scale-95 whitespace-nowrap">
                                <Filter size={14} className="mr-2" />
                                Filtrar
                            </button>
                        </div>

                        <div className="card overflow-hidden shadow-flat" style={{ padding: '0', border: 'none' }}>
                            <table className="data-table w-full">
                                <thead>
                                    <tr className="text-left bg-slate-50/50 border-b border-slate-100">
                                        <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest w-[100px]">NÚMERO</th>
                                        <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">CLIENTE / EVENTO</th>
                                        <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest w-[150px]">FECHA PAGO</th>
                                        <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest w-[100px]">VENCIMIENTO</th>
                                        <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest w-[120px]">TOTAL</th>
                                        <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest w-[140px]">ESTADO</th>
                                        <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest text-right w-[180px]">ACCIONES</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredQuotes.map(q => (
                                        <tr key={q.id} className="group border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-all cursor-pointer" onClick={() => { setSelectedQuote(q); setView('preview'); }}>
                                            <td className="py-6 px-8 font-black text-blue-600">#{q.id}</td>
                                            <td className="py-6 px-8">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-700 text-sm">{q.client}</span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[0.6rem] font-bold uppercase tracking-wide border ${q.clientType === 'Productora' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                                            q.clientType === 'Empresa' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                                'bg-slate-50 text-slate-600 border-slate-100'
                                                            }`}>
                                                            {q.clientType || 'Otro'}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                                        {q.eventName || q.eventDate}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-6 px-8" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={14} className="text-slate-300" />
                                                    <input
                                                        type="date"
                                                        value={q.paymentDate || ''}
                                                        onChange={(e) => handlePaymentDateChange(e, q.id)}
                                                        className="bg-transparent text-xs font-bold text-slate-600 outline-none border-none p-0 w-[110px] cursor-pointer hover:bg-slate-100 rounded px-1 transition-colors"
                                                    />
                                                </div>
                                            </td>
                                            <td className="py-6 px-8 text-xs font-bold text-slate-500">
                                                {q.expiration_date || q.expirationDate || '-'}
                                            </td>
                                            <td className="py-6 px-8 font-black text-slate-900">${Math.round(q.total * 1.19).toLocaleString()}</td>

                                            <td className="py-6 px-8" onClick={(e) => e.stopPropagation()}>
                                                <div className="relative">
                                                    <select
                                                        value={q.status}
                                                        onChange={(e) => handleStatusChange(e, q.id)}
                                                        className={`appearance-none pl-3 pr-3 text-center py-1.5 rounded-lg text-xs font-bold border-none outline-none cursor-pointer transition-all ${q.status === 'Aceptada' ? 'bg-indigo-100/50 text-indigo-700 hover:bg-indigo-100' :
                                                            q.status === 'Pagada' ? 'bg-emerald-100/50 text-emerald-700 hover:bg-emerald-100' :
                                                                q.status === 'Enviada' ? 'bg-blue-100/50 text-blue-700 hover:bg-blue-100' :
                                                                    'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                            }`}
                                                    >
                                                        <option value="Borrador">Borrador</option>
                                                        <option value="Enviada">Enviada</option>
                                                        <option value="Aceptada">Aceptada</option>
                                                        <option value="Pago Parcial">Pago Parcial</option>
                                                        <option value="Pagada">Pagada</option>
                                                        <option value="Nula">Nula</option>
                                                    </select>
                                                </div>
                                            </td>
                                            <td className="py-6 px-8 text-right" onClick={(e) => e.stopPropagation()}>
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
                                                        <label className={`cursor-pointer p-1.5 rounded-md transition-all ${q.invoiceUrl ? 'text-slate-400 hover:text-blue-600 hover:bg-white' : 'text-slate-400 hover:text-blue-600 hover:bg-white'}`} title={q.invoiceUrl ? "Reemplazar Factura" : "Subir Factura"}>
                                                            <input type="file" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, q.id, 'invoice')} accept=".pdf,.png,.jpg,.jpeg" />
                                                            {q.invoiceUrl ? <Upload size={14} /> : <FileText size={14} />}
                                                        </label>
                                                    </div>

                                                    {/* Voucher Actions */}
                                                    <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                                                        {q.voucherUrl && (
                                                            <a
                                                                href={q.voucherUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-1.5 text-emerald-600 hover:bg-white rounded-md transition-all shadow-sm"
                                                                title="Ver Voucher"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <Eye size={14} />
                                                            </a>
                                                        )}
                                                        <label className={`cursor-pointer p-1.5 rounded-md transition-all ${q.voucherUrl ? 'text-slate-400 hover:text-emerald-600 hover:bg-white' : 'text-slate-400 hover:text-emerald-600 hover:bg-white'}`} title={q.voucherUrl ? "Reemplazar Voucher" : "Subir Voucher"}>
                                                            <input type="file" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, q.id, 'voucher')} accept=".pdf,.png,.jpg,.jpeg" />
                                                            {q.voucherUrl ? <Upload size={14} /> : <Upload size={14} />}
                                                        </label>
                                                    </div>

                                                    <button
                                                        onClick={() => sendWhatsAppNotification(q)}
                                                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors ml-2"
                                                        title="Notificar a Natalia"
                                                    >
                                                        <MessageCircle size={16} />
                                                    </button>
                                                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white rounded-lg font-bold text-xs transition-all whitespace-nowrap ml-2" onClick={() => { setSelectedQuote(q); setView('preview'); }} title="Vista Cliente"><Eye size={14} /> Ver</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {view === 'create' && (
                    <QuoteForm
                        clientDatabase={clientDatabase}
                        events={events}
                        setEvents={setEvents}
                        onSave={(quote) => {
                            setQuotes([...quotes, quote]);
                            setView('list');
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
                                    onClick={() => generateQuotePDF(selectedQuote)}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md whitespace-nowrap"
                                >
                                    <Download size={18} /> <span>Descargar PDF</span>
                                </button>
                            </div>
                        </div>
                        <div className="preview-paper-container shadow-2xl">
                            {/* Pass handlers to RenderModel if needed, or implement UI there */}
                            <RenderPuntoUrbanoModel quote={selectedQuote} showPrices={view === 'preview'} />

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
        </motion.div>
    );
};



export default QuoteEngine;
