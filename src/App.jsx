import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    LayoutDashboard,
    Users,
    FileText,
    CreditCard,
    Truck,
    Calendar as CalendarIcon,
    Settings as SettingsIcon,
    Plus,
    Clock,
    Sofa,
    Package,
    Tag,
    FileUp,
    Edit,
    Trash,
    ChevronDown,
    ChevronRight,
    ChevronLeft,
    Search,
    Download,
    Filter,
    ArrowRight,
    X,
    Lock,
    LogOut,
    Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import Services from './components/Services';
import './App.css';
import QuoteEngine from './components/QuoteEngine';
import Calendar from './components/Calendar';
import Payments from './components/Payments';
import Login from './components/Login';
import Settings from './components/Settings';
import { supabase } from './supabaseClient';



const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-slate-900 px-4 py-3 rounded-xl shadow-xl border border-slate-700 pointer-events-none min-w-[220px] z-50">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 border-b border-slate-700 pb-2">{label}</p>

                <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Total</span>
                    <span className="text-sm font-black text-white">${data.rawTotal?.toLocaleString('es-CL') || 0}</span>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Ingresos Neto:</span>
                        <span className="text-white font-bold">${data.rawTotal?.toLocaleString('es-CL') || 0}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Logistica:</span>
                        <span className="text-white font-bold">${data.logistica?.toLocaleString('es-CL') || 0}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Gastos:</span>
                        <span className="text-white font-bold">${data.gastos?.toLocaleString('es-CL') || 0}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
                        <span className="text-blue-400 font-black uppercase tracking-widest text-[10px]">Utilidad:</span>
                        <span className="text-blue-400 font-black text-sm">${(data.rawTotal - data.logistica - (data.gastos || 0)).toLocaleString('es-CL') || 0}</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

const Dashboard = ({ quotes, payments, events }) => {
    const [salesView, setSalesView] = useState('monthly');
    const [userView, setUserView] = useState('all');
    const [metrics, setMetrics] = useState({ totalRevenue: 0, totalExpenses: 0, netIncome: 0, logistics: 0, projects: 0 });
    const [chartData, setChartData] = useState([]);
    const [pieChartData, setPieChartData] = useState([]);
    const [selectedData, setSelectedData] = useState(null);
    const [dateFrom, setDateFrom] = useState('2026-01-01');
    const [dateTo, setDateTo] = useState('2026-12-31');

    useEffect(() => {
        calculateMetrics();
    }, [quotes, payments, events, dateFrom, dateTo]);

    const calculateMetrics = () => {
        try {
            // Filter Data by Date Range
            const from = new Date(`${dateFrom}T00:00:00`);
            const to = new Date(`${dateTo}T23:59:59`);

            const filteredQuotes = (quotes || []).filter(q => {
                // Use eventDate/event_date exclusively as the reference
                const dateStr = q.eventDate || q.event_date;
                if (!dateStr) return false;
                const d = new Date(dateStr);
                return d >= from && d <= to && q.status === 'Aceptada';
            });

            const filteredPayments = (payments || []).filter(p => {
                // Use p.fecha (the date of the expense/payment) as the reference
                const d = new Date(p.fecha + "T12:00:00Z");
                return d >= from && d <= to;
            });

            const filteredEvents = (events || []).filter(e => {
                const d = new Date(e.date);
                return d >= from && d <= to;
            });

            // Pie Chart Data (Category Breakdown)
            let catMobiliario = 0;
            let catLogistica = 0;
            let catOtros = 0;

            filteredQuotes.forEach(q => {
                if (q.items) {
                    const accessories = q.items.accesorios || [];
                    const logistics = q.items.logistica || [];
                    const others = q.items.otros || [];

                    catMobiliario += accessories.reduce((sum, item) => sum + (item.total || 0), 0);
                    catLogistica += logistics.reduce((sum, item) => sum + (item.total || 0), 0);
                    catOtros += others.reduce((sum, item) => sum + (item.total || 0), 0);
                }
            });

            // Metrics Calculation
            const totalRevenue = filteredQuotes.reduce((acc, q) => acc + (Number(q.total) || 0), 0);

            // Calculate Expenses (Only 'Pago' type counts as expense)
            const totalExpenses = filteredPayments
                .filter(p => p.tipo === 'Pago')
                .reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

            const netIncome = totalRevenue - totalExpenses - catLogistica;

            setMetrics({
                totalRevenue,
                totalExpenses,
                netIncome,
                logistics: catLogistica,
                projects: filteredQuotes.length || 0
            });

            setPieChartData([
                { name: 'Mobiliario', value: catMobiliario, fill: '#3b82f6' },
                { name: 'Logística', value: catLogistica, fill: '#10b981' },
                { name: 'Otros', value: catOtros, fill: '#db2777' },
            ]);

            const getMonthKey = (dateStr) => {
                if (!dateStr) return null;
                // Handle YYYY-MM-DD or full dates correctly
                const date = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00Z`);
                return date.toLocaleString('es-CL', { month: 'short' });
            };

            // Bar Chart Data (Group by Month)
            const months = {};
            filteredQuotes.forEach(q => {
                const monthKey = getMonthKey(q.eventDate || q.event_date);
                if (!monthKey) return;

                if (!months[monthKey]) {
                    months[monthKey] = {
                        total: 0,
                        mobiliario: 0,
                        logistica: 0,
                        otros: 0,
                        gastos: 0
                    };
                }

                months[monthKey].total += (Number(q.total) || 0);

                if (q.items) {
                    const accessories = q.items.accesorios || [];
                    const logistics = q.items.logistica || [];
                    const others = q.items.otros || [];

                    months[monthKey].mobiliario += accessories.reduce((sum, item) => sum + (item.total || 0), 0);
                    months[monthKey].logistica += logistics.reduce((sum, item) => sum + (item.total || 0), 0);
                    months[monthKey].otros += others.reduce((sum, item) => sum + (item.total || 0), 0);
                }
            });

            // Group payments into months too
            filteredPayments.forEach(p => {
                const monthKey = getMonthKey(p.fecha || p.created_at);
                if (!monthKey) return;

                if (months[monthKey]) {
                    if (p.tipo === 'Pago') {
                        months[monthKey].gastos += (Number(p.monto) || 0);
                    }
                } else {
                    months[monthKey] = {
                        total: 0,
                        mobiliario: 0,
                        logistica: 0,
                        otros: 0,
                        gastos: p.tipo === 'Pago' ? (Number(p.monto) || 0) : 0
                    };
                }
            });

            const monthOrder = {
                'ene.': 0, 'feb.': 1, 'mar.': 2, 'abr.': 3, 'may.': 4, 'jun.': 5,
                'jul.': 6, 'ago.': 7, 'sep.': 8, 'sept.': 8, 'oct.': 9, 'nov.': 10, 'dic.': 11
            };

            const processedChartData = Object.keys(months).map(key => ({
                name: key,
                monthIndex: monthOrder[key.toLowerCase()] ?? 99,
                total: months[key].total / 1000000,
                rawTotal: months[key].total,
                mobiliario: months[key].mobiliario,
                logistica: months[key].logistica,
                otros: months[key].otros,
                gastos: months[key].gastos
            })).sort((a, b) => a.monthIndex - b.monthIndex);

            setChartData(processedChartData);
            if (processedChartData.length > 0) setSelectedData(processedChartData[0]);

        } catch (error) {
            console.error('Error calculating metrics:', error);
        }
    };


    const handleUserFilter = () => {
        setUserView(prev => prev === 'all' ? 'eric' : 'all');
    };

    const formatDateLabel = (dateStr) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${d} ${months[parseInt(m) - 1]} ${y}`;
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex justify-between items-end mb-10">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">Panel de Control</h1>
                    <p className="text-gray-500 font-medium">Estado actual de Punto Urbano.</p>
                </div>
                <div className="flex gap-4 items-center">
                    <button
                        onClick={handleUserFilter}
                        className={`px-4 py-2 h-[42px] rounded-xl text-xs font-bold uppercase tracking-widest transition-all h-[42px] flex items-center justify-center ${userView === 'eric' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                    >
                        {userView === 'eric' ? 'Vista: Eric' : 'Vista: Global'}
                    </button>

                    <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-1.5 h-[46px] gap-2 text-slate-500 hover:border-blue-400 transition-all shadow-sm relative group no-print">
                        <div className="bg-blue-50 p-1.5 rounded-lg mr-1">
                            <CalendarIcon size={14} className="text-blue-600" />
                        </div>

                        <div className="flex items-center">
                            <div className="relative flex flex-col items-start px-2 py-0.5 rounded-lg transition-colors cursor-pointer hover:bg-slate-50 overflow-hidden">
                                <span className="text-[10px] font-black uppercase tracking-tighter text-blue-400/80 leading-tight">Desde</span>
                                <span className="text-xs font-black text-slate-700 tracking-tight">{formatDateLabel(dateFrom)}</span>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="clean-date-input"
                                />
                            </div>

                            <div className="flex flex-col items-center px-1">
                                <ChevronRight size={10} className="text-slate-300" />
                            </div>

                            <div className="relative flex flex-col items-start px-2 py-0.5 rounded-lg transition-colors cursor-pointer hover:bg-slate-50 overflow-hidden">
                                <span className="text-[10px] font-black uppercase tracking-tighter text-blue-400/80 leading-tight">Hasta</span>
                                <span className="text-xs font-black text-slate-700 tracking-tight">{formatDateLabel(dateTo)}</span>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="clean-date-input"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="card px-6 py-2 bg-blue-50 border-blue-100 flex flex-col transition-all duration-300">
                        <span className="text-[0.6rem] font-black uppercase tracking-widest text-blue-400">
                            Neto
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-black text-blue-600">
                                ${(metrics.totalRevenue).toLocaleString('es-CL')}
                            </span>
                        </div>
                    </div>
                    <div className="card px-6 py-2 bg-amber-50 border-amber-100 flex flex-col transition-all duration-300">
                        <span className="text-[0.6rem] font-black uppercase tracking-widest text-amber-500">
                            Logística
                        </span>
                        <span className="text-xl font-black text-amber-600">
                            ${(metrics.logistics).toLocaleString('es-CL')}
                        </span>
                    </div>
                    <div className="card px-6 py-2 bg-red-50 border-red-100 flex flex-col transition-all duration-300">
                        <span className="text-[0.6rem] font-black uppercase tracking-widest text-red-400">
                            Gastos
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-black text-red-600">
                                ${(metrics.totalExpenses).toLocaleString('es-CL')}
                            </span>
                        </div>
                    </div>
                    <div className="card px-6 py-2 bg-emerald-50 border-emerald-100 flex flex-col transition-all duration-300">
                        <span className="text-[0.6rem] font-black uppercase tracking-widest text-emerald-500">
                            Utilidad
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-black text-emerald-600">
                                ${(metrics.netIncome).toLocaleString('es-CL')}
                            </span>
                        </div>
                    </div>
                    <div className="card px-6 py-2 bg-emerald-50 border-emerald-100 flex flex-col transition-all duration-300">
                        <span className="text-[0.6rem] font-black uppercase tracking-widest text-emerald-400">
                            Proyectos
                        </span>
                        <span className="text-xl font-black text-emerald-600">
                            {metrics.projects}
                        </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="card p-8 lg:col-span-2 shadow-premium">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            {salesView === 'monthly' ? 'Ingresos Mensuales (Millones CLP)' : 'Ingresos Semanales (Millones CLP)'}
                        </h3>
                        <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                            <button
                                onClick={() => setSalesView('monthly')}
                                className={`px-6 py-2 text-xs font-bold rounded-md transition-all ${salesView === 'monthly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Mensual
                            </button>
                            <button
                                onClick={() => setSalesView('weekly')}
                                className={`px-6 py-2 text-xs font-bold rounded-md transition-all ${salesView === 'weekly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Semanal
                            </button>
                        </div>
                    </div>
                    <div style={{ height: '300px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                style={{ cursor: 'pointer' }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 4 }} />
                                <Bar
                                    dataKey="total"
                                    radius={[4, 4, 0, 0]}
                                    barSize={32}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={'#3b82f6'}
                                            className="transition-all duration-300 hover:opacity-80"
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card p-8 shadow-premium">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Distribución de Gastos</h3>
                    <div style={{ height: '300px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieChartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                        {pieChartData.map(item => (
                            <div key={item.name} className="flex justify-between items-center text-sm">
                                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ background: item.fill }} /> {item.name}</span>
                                <span className="font-bold">{((item.value / 1000) * 100).toFixed(0)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};



const ClientModal = ({ isOpen, onClose, onSave, client, categories = [] }) => {
    const [formData, setFormData] = useState({
        name: '', contact: '', email: '', phone: '', type: 'Empresa', category: '', notes: ''
    });

    useEffect(() => {
        if (client) {
            setFormData(client);
        } else {
            setFormData({ name: '', contact: '', email: '', phone: '', type: 'Empresa', category: '', notes: '' });
        }
    }, [client, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 transition-all duration-300" style={{ zIndex: 9999999 }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden border border-slate-100"
            >
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">{client ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Empresa / Cliente</label>
                        <input required type="text" className="w-full input-field" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Productora XYZ" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contacto</label>
                            <input type="text" className="w-full input-field" value={formData.contact || ''} onChange={e => setFormData({ ...formData, contact: e.target.value })} placeholder="Ej: Juan Pérez" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teléfono</label>
                            <input type="text" className="w-full input-field" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+569..." />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                        <input type="email" className="w-full input-field" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="contacto@empresa.com" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                            <select className="w-full input-field" value={formData.type || 'Empresa'} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                <option value="Empresa">Empresa</option>
                                <option value="Productora">Productora</option>
                                <option value="Banquetería">Banquetería</option>
                                <option value="Particular">Particular</option>
                            </select>
                        </div>

                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notas</label>
                        <textarea className="w-full input-field" rows="3" value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Información adicional..."></textarea>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancelar</button>
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">Guardar</button>
                    </div>
                </form>
            </motion.div>
        </div>,
        document.body
    );
};

const Clients = () => {
    const [clients, setClients] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentClient, setCurrentClient] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch clients on mount
    React.useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setClients(data || []);
        } catch (error) {
            console.error('Error fetching clients:', error);
            console.log('Clients error details:', JSON.stringify(error, null, 2));
            alert('Error al cargar clientes: ' + (error.message || 'Desconocido'));
        } finally {
            setIsLoading(false);
        }
    };

    const filteredClients = clients.filter(client =>
        (client.name && client.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (client.contact && client.contact.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const uniqueCategories = [...new Set(clients.map(c => c.category))].filter(Boolean).sort();

    const handleAddNew = () => {
        setCurrentClient(null);
        setIsModalOpen(true);
    };

    const handleEdit = (client) => {
        setCurrentClient(client);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (confirm('¿Estás seguro de eliminar este cliente?')) {
            try {
                const { error } = await supabase
                    .from('clients')
                    .delete()
                    .eq('id', id);

                if (error) throw error;
                setClients(clients.filter(c => c.id !== id));
            } catch (error) {
                console.error('Error deleting client:', error);
                alert('Error al eliminar cliente');
            }
        }
    };

    const handleSaveClient = async (clientData) => {
        try {
            if (currentClient) {
                // Update
                const { error } = await supabase
                    .from('clients')
                    .update(clientData)
                    .eq('id', currentClient.id); // Assuming ID is preserved in clientData or we use currentClient.id

                if (error) throw error;

                // Refresh to get latest data or update local state optimistically
                fetchClients();
            } else {
                // Create
                const { error } = await supabase
                    .from('clients')
                    .insert([clientData]);

                if (error) throw error;
                fetchClients();
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving client:', error);
            alert('Error al guardar cliente');
        }
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target.result;
            const lines = content.split('\n');
            const newClients = [];

            // Assume header row exists and skip it
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                // Simple CSV parsing (does not handle quoted values with commas)
                const [name, contact, email, phone, type, category, notes] = line.split(',').map(item => item?.trim() || '');

                if (name) {
                    newClients.push({
                        name,
                        contact,
                        email,
                        phone,
                        type: type || 'Empresa',
                        category,
                        notes
                    });
                }
            }

            if (newClients.length > 0) {
                try {
                    const { error } = await supabase.from('clients').insert(newClients);
                    if (error) throw error;

                    fetchClients();
                    alert(`${newClients.length} clientes importados correctamente.`);
                } catch (error) {
                    console.error('Error importing clients:', error);
                    alert('Error al importar clientes');
                }
            } else {
                alert('No se encontraron clientes válidos en el archivo CSV.');
            }

            // Reset input
            event.target.value = '';
        };
        reader.readAsText(file);
    };

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <ClientModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveClient}
                client={currentClient}
                categories={uniqueCategories}
            />

            <div className="flex justify-between items-end mb-10">
                <div>
                    <h1 className="text-3xl font-black">Directorio de Clientes</h1>
                    <p className="text-gray-500 font-medium">Gestión integral de cartera y contactos.</p>
                </div>
                <div className="flex gap-2">
                    <label
                        className="flex items-center gap-3 px-8 py-3 text-white font-bold rounded-xl hover:opacity-90 transition-all cursor-pointer shadow-lg shadow-emerald-500/30 border-none"
                        style={{ backgroundColor: '#059669' }}
                    >
                        <FileUp size={20} strokeWidth={2.5} />
                        <span className="text-base text-white">Importar CSV</span>
                        <input
                            type="file"
                            accept=".csv"
                            style={{ display: 'none' }}
                            onChange={handleFileUpload}
                        />
                    </label>
                    <button
                        onClick={handleAddNew}
                        className="flex items-center gap-3 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/30 transition-all border-none"
                    >
                        <Plus size={20} strokeWidth={3} /> <span className="text-base">Nuevo Cliente</span>
                    </button>
                </div>
            </div>

            <div className="mb-8 relative group">
                <input
                    type="text"
                    placeholder="Buscar cliente por nombre, contacto o notas..."
                    className="input-field h-[48px] text-base"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="card overflow-hidden shadow-flat" style={{ border: 'none' }}>
                <table className="data-table w-full">
                    <thead>
                        <tr className="text-left bg-slate-50 border-b border-slate-100">
                            <th className="py-6 px-8 text-xs font-black text-slate-400 uppercase tracking-widest">CLIENTE</th>
                            <th className="py-6 px-8 text-xs font-black text-slate-400 uppercase tracking-widest">CONTACTO</th>
                            <th className="py-6 px-8 text-xs font-black text-slate-400 uppercase tracking-widest">TIPO</th>
                            <th className="py-6 px-8 text-xs font-black text-slate-400 uppercase tracking-widest text-right">ACCIONES</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredClients.map((client) => (
                            <tr key={client.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-all cursor-pointer group">
                                <td className="py-6 px-8" onClick={() => handleEdit(client)}>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-900">{client.name}</span>
                                        <span className="text-xs text-slate-400 truncate max-w-[200px]">{client.notes}</span>
                                    </div>
                                </td>
                                <td className="py-6 px-8" onClick={() => handleEdit(client)}>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-slate-700">{client.contact}</span>
                                        <div className="flex flex-col text-xs text-slate-400">
                                            <a
                                                href={`mailto:${client.email}`}
                                                className="text-blue-600 font-medium hover:underline"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {client.email}
                                            </a>
                                            <span>{client.phone}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-6 px-8" onClick={() => handleEdit(client)}>
                                    <span className={`badge ${client.type === 'Empresa' ? 'bg-indigo-100 text-indigo-700' : client.type === 'Productora' ? 'bg-purple-100 text-purple-700' : client.type === 'Banquetería' ? 'bg-orange-100 text-orange-700' : 'bg-pink-100 text-pink-700'}`}>
                                        {client.type}
                                    </span>
                                </td>
                                <td className="py-6 px-8 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <a
                                            href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                                            title="Enviar WhatsApp"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WA" className="w-4 h-4" />
                                        </a>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleEdit(client); }}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
};






// --- Login Component ---


// --- App Component ---
const App = () => {
    const [activeTab, setActiveTab] = useState('quotes');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Supabase Auth State
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [userRole, setUserRole] = useState(null); // 'admin', 'user', etc.
    const [userPermissions, setUserPermissions] = useState([]); // List of allowed tab IDs
    const [isProfileLoaded, setIsProfileLoaded] = useState(false);

    // Data State
    const [quotes, setQuotes] = useState([]);
    const [events, setQuotesEvents] = useState([]);
    const [payments, setPayments] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [clients, setClients] = useState([]);

    useEffect(() => {
        // checkpoint for session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        }).catch((error) => {
            console.error('Error getting session:', error);
            setLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setLoading(false); // Ensure loading is disabled on auth change too
        });

        return () => subscription.unsubscribe();
    }, []);

    // Simulated Progress Bar Effect
    useEffect(() => {
        let interval;
        if (loading || (session && !isProfileLoaded)) {
            interval = setInterval(() => {
                setProgress(prev => {
                    // Slow down the progress as it gets closer to 99%
                    const increment = Math.max(1, Math.floor((99 - prev) / 10));
                    return prev >= 99 ? 99 : prev + increment;
                });
            }, 50);
        } else {
            setProgress(100);
        }
        return () => clearInterval(interval);
    }, [loading, session, isProfileLoaded]);

    const fetchData = async () => {
        try {
            const [
                { data: quotesData },
                { data: eventsData },
                { data: paymentsData },
                { data: inventoryData },
                { data: clientsData },
                profileRes
            ] = await Promise.all([
                supabase.from('quotes').select('*'),
                supabase.from('events').select('*'),
                supabase.from('payments').select('*'),
                supabase.from('inventory').select('*'),
                supabase.from('clients').select('*'),
                session?.user?.id ? supabase.from('profiles').select('role, permissions').eq('id', session.user.id).single() : Promise.resolve({ data: null })
            ]);

            if (quotesData) {
                const mappedQuotes = quotesData.map(q => ({
                    ...q,
                    invoiceUrl: q.invoice_url,
                    voucherUrl: q.voucher_url,
                    voucherUrls: q.voucher_urls,
                    paymentDate: q.payment_date || q.paymentDate,
                    clientType: q.client_type || q.clientType,
                    eventName: q.event_name || q.eventName,
                    eventDate: q.event_date || q.eventDate,
                    eventNotes: q.event_notes || q.eventNotes,
                    location: q.location || q.location,
                    paymentStatus: (q.payment_status || 'Impaga').trim()
                }));
                setQuotes(mappedQuotes);
            }

            if (eventsData) setQuotesEvents(eventsData);
            if (paymentsData) setPayments(paymentsData);
            if (inventoryData) setInventory(inventoryData);
            if (clientsData) setClients(clientsData);

            if (profileRes.data) {
                setUserRole(profileRes.data.role);
                setUserPermissions(profileRes.data.permissions || []);

                // If activeTab is not in their permissions, redirect them to the first available tab, or 'unauthorized' screen
                if (profileRes.data.permissions && profileRes.data.permissions.length > 0 && !profileRes.data.permissions.includes(activeTab)) {
                    setActiveTab(profileRes.data.permissions[0]);
                }
            }
            setIsProfileLoaded(true);

        } catch (error) {
            console.error('Error fetching data:', error);
            setIsProfileLoaded(true); // Don't hang forever on network error
        }
    };

    useEffect(() => {
        if (session) {
            fetchData();

            // Set up real-time subscription with debounce to avoid flickering and multiple re-renders
            let timeoutId = null;
            const channel = supabase
                .channel('db-changes')
                .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                    console.log('Change received!', payload);
                    if (timeoutId) clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        fetchData();
                    }, 500); // 500ms debounce
                })
                .subscribe();

            return () => {
                if (timeoutId) clearTimeout(timeoutId);
                supabase.removeChannel(channel);
            };
        }
    }, [session]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };


    const allMenuItems = [
        { id: 'quotes', label: 'Cotizaciones', icon: FileText },
        { id: 'dashboard', label: 'Panel de Control', icon: LayoutDashboard },
        { id: 'clients', label: 'Clientes', icon: Users },
        { id: 'payments', label: 'Pagos y Canjes', icon: CreditCard },
        { id: 'services', label: 'Inventario', icon: Package },
        { id: 'calendar', label: 'Calendario', icon: CalendarIcon },
        { id: 'settings', label: 'Ajustes', icon: SettingsIcon },
    ];

    // Filter menu items based on user permissions
    const menuItems = allMenuItems.filter(item =>
        userRole === 'admin' || userPermissions.includes(item.id)
    );

    if (loading || (session && !isProfileLoaded)) {
        return (
            <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white overflow-hidden">

                <div className="relative flex flex-col items-center animate-in fade-in zoom-in duration-700 delay-150 z-10 w-full max-w-xs">
                    <motion.div
                        className="mb-6 relative"
                        initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
                        animate={{
                            scale: [1, 1.1, 1],
                            opacity: 1,
                            rotate: 0,
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    >
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-30 rounded-full scale-110 animate-pulse"></div>
                        <Sofa size={56} className="text-blue-600 relative z-10" strokeWidth={2.5} />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.8 }}
                        className="flex items-baseline gap-1.5 z-10 mb-8"
                    >
                        <span className="font-black text-slate-800 text-3xl tracking-tighter">PUNTO</span>
                        <span className="font-light text-slate-400 text-3xl tracking-tighter">URBANO</span>
                    </motion.div>

                    {/* Filling Loading Bar */}
                    <div className="w-56 flex flex-col items-center">
                        <div className="flex justify-between w-full mb-2 px-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cargando módulos</span>
                            <span className="text-[10px] font-black text-blue-600">{progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100/80 rounded-full overflow-hidden relative shadow-inner">
                            <div
                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-200 ease-out"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!session) {
        return <Login />;
    }

    return (
        <div className="layout-container font-['Outfit']">
            <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header flex items-center justify-between">
                    <div className="logo-box">
                        <Sofa size={28} color="white" strokeWidth={2.5} className="flex-shrink-0" />
                        <div className="logo-text flex items-baseline">
                            <span className="font-black text-white text-xl tracking-tighter">PUNTO</span>
                            <span className="font-light text-slate-300 text-xl tracking-tighter">URBANO</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                    >
                        {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                    </button>
                </div>

                <nav className="sidebar-nav mt-8">
                    {menuItems.length > 0 ? (
                        menuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`nav-item mb-2 ${activeTab === item.id ? 'active' : ''}`}
                            >
                                <item.icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                                <span className="text-[0.95rem]">{item.label}</span>
                            </button>
                        ))
                    ) : (
                        <div className="px-4 text-center mt-10">
                            <Lock size={32} className="mx-auto text-slate-500 mb-2 opacity-30" />
                            <p className="text-sm font-medium text-slate-400">Sin accesos</p>
                        </div>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <button
                        onClick={handleLogout}
                        className="nav-item logout w-full opacity-60 hover:opacity-100 transition-opacity"
                    >
                        <LogOut size={22} />
                        <span className="text-[0.95rem]">Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <header className="top-bar">
                    <div className="search-box">
                        <input type="text" className="font-medium" placeholder="Buscar en el sistema..." />
                    </div>
                    <div className="top-bar-actions">
                        <div className="flex gap-2">
                            <button className="icon-btn hover:shadow-md transition-all"><Bell size={20} /></button>
                            <button className="icon-btn hover:shadow-md transition-all"><SettingsIcon size={20} /></button>
                        </div>
                        <div className="user-profile">
                            <div className="avatar">AD</div>
                            <div className="flex flex-col ml-1">
                                <span className="text-sm font-bold leading-none">{session.user.email}</span>
                                <span className="text-[0.7rem] text-slate-400 font-bold uppercase tracking-wider mt-1">Super User</span>
                            </div>
                        </div>
                    </div>
                </header>

                <section className="page-content bg-[#f8fafc]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                        >
                            {activeTab === 'dashboard' && (userRole === 'admin' || userPermissions.includes('dashboard')) && <Dashboard quotes={quotes} events={events} payments={payments} />}
                            {activeTab === 'clients' && (userRole === 'admin' || userPermissions.includes('clients')) && <Clients />}
                            {activeTab === 'payments' && (userRole === 'admin' || userPermissions.includes('payments')) && <Payments payments={payments} setPayments={setPayments} />}
                            {activeTab === 'services' && (userRole === 'admin' || userPermissions.includes('services')) && <Services />}
                            {activeTab === 'quotes' && (userRole === 'admin' || userPermissions.includes('quotes')) && <QuoteEngine quotes={quotes} setQuotes={setQuotes} events={events} setEvents={setQuotesEvents} />}
                            {activeTab === 'calendar' && (userRole === 'admin' || userPermissions.includes('calendar')) && <Calendar events={events} setEvents={setQuotesEvents} />}

                            {/* Empty State for specific unauth check or pending approval */}
                            {userPermissions.length === 0 && userRole !== 'admin' && (
                                <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
                                    <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                                        <Lock size={40} strokeWidth={2} />
                                    </div>
                                    <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Acceso Pendiente</h2>
                                    <p className="text-slate-500 max-w-sm mb-8 text-base font-medium">
                                        Tu cuenta ha sido creada exitosamente, pero el administrador aún debe asignarte los módulos a los que tendrás acceso. Vuelve a intentar más tarde.
                                    </p>
                                </div>
                            )}

                            {activeTab === 'settings' && userRole === 'admin' && <Settings userRole={userRole} />}
                        </motion.div>
                    </AnimatePresence>
                </section>
            </main>
        </div>
    );
}

export default App;
