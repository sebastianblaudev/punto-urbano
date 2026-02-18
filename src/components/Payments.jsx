import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Edit, Trash, Search, DollarSign, Tag, Clock, ArrowRight, X, Save, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Payments = ({ payments, setPayments }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPayment, setEditingPayment] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        empresa: '',
        observacion: '',
        monto: '',
        tipo: 'Pago',
        category: ''
    });

    const uniqueCategories = [...new Set(payments.map(p => p.category))].filter(Boolean).sort();

    const handleOpenModal = (payment = null) => {
        if (payment) {
            setEditingPayment(payment);
            setFormData({ ...payment });
            setFormData({ ...payment });
        } else {
            setEditingPayment(null);
            setFormData({ empresa: '', observacion: '', monto: '', tipo: 'Pago', category: '' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.empresa || !formData.monto) return;

        try {
            if (editingPayment) {
                const { error } = await supabase.from('payments').update(formData).eq('id', editingPayment.id);
                if (error) throw error;
                setPayments(payments.map(p => p.id === editingPayment.id ? { ...formData, id: p.id } : p));
            } else {
                const { data, error } = await supabase.from('payments').insert([formData]).select();
                if (error) throw error;
                if (data) setPayments([...payments, ...data]);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving payment:', error);
            alert('Error al guardar pago');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este pago?')) {
            try {
                const { error } = await supabase.from('payments').delete().eq('id', id);
                if (error) throw error;
                setPayments(payments.filter(p => p.id !== id));
            } catch (error) {
                console.error('Error deleting payment:', error);
                alert('Error al eliminar pago');
            }
        }
    };

    const filteredPayments = payments.filter(p =>
        p.empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.observacion.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-8">
            <div className="module-header flex justify-between items-end mb-4">
                <div>
                    <h1 className="text-3xl font-black">Pagos y Canjes</h1>
                    <p className="text-slate-500 font-medium tracking-tight">Registro de transacciones comerciales</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-3 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/30 transition-all border-none"
                >
                    <Plus size={20} strokeWidth={3} /> <span className="text-base">Nuevo Registro</span>
                </button>
            </div>

            <div className="flex flex-row gap-6 items-end px-2 mb-2">
                <div className="flex-[2] min-w-[250px]">
                    <label className="label-field text-[0.6rem] text-slate-400">Buscar en registros</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar empresa u observación..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-field h-[40px] text-xs bg-slate-100/50 pl-10"
                        />
                    </div>
                </div>
            </div>

            <div className="card overflow-hidden shadow-flat" style={{ padding: '0', border: 'none' }}>
                <table className="data-table w-full">
                    <thead>
                        <tr className="text-left bg-slate-50/50 border-b border-slate-100">
                            <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">EMPRESA</th>
                            <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">CATEGORÍA</th>
                            <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">OBSERVACIÓN</th>
                            <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">TIPO</th>
                            <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">MONTO</th>
                            <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest text-right">ACCIONES</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPayments.map(p => (
                            <tr key={p.id} className="group border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-all">
                                <td className="py-6 px-8 font-bold text-slate-800">{p.empresa}</td>
                                <td className="py-6 px-8">
                                    <span className="px-2 py-1 rounded-md bg-slate-100 text-[0.65rem] font-bold text-slate-600 uppercase tracking-wider border border-slate-200">{p.category || '-'}</span>
                                </td>
                                <td className="py-6 px-8">
                                    <span className="text-xs text-slate-500 font-medium">{p.observacion}</span>
                                </td>
                                <td className="py-6 px-8">
                                    <span className={`px-2 py-1 rounded text-[0.6rem] font-black uppercase tracking-widest ${p.tipo === 'Canje' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                                        }`}>
                                        {p.tipo}
                                    </span>
                                </td>
                                <td className="py-6 px-8 font-black text-slate-900">${Number(p.monto).toLocaleString()}</td>
                                <td className="py-6 px-8 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => handleOpenModal(p)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                            <Edit size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md relative"
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 className="text-xl font-black mb-6">{editingPayment ? 'Editar Registro' : 'Nuevo Registro'}</h2>

                            <div className="space-y-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="label-field">Empresa</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={formData.empresa}
                                        onChange={e => setFormData({ ...formData, empresa: e.target.value })}
                                        placeholder="Ej: Entel, Coca Cola..."
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="label-field">Categoría</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            list="category-options"
                                            className="input-field"
                                            value={formData.category || ''}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                            placeholder="Ej: Servicios, Materiales..."
                                        />
                                        <datalist id="category-options">
                                            {uniqueCategories.map((c, i) => (
                                                <option key={i} value={c} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="label-field">Tipo</label>
                                    <select
                                        className="input-field"
                                        value={formData.tipo}
                                        onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                                    >
                                        <option value="Pago">Pago</option>
                                        <option value="Canje">Canje</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="label-field">Monto</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                        <input
                                            type="number"
                                            className="input-field pl-8"
                                            value={formData.monto}
                                            onChange={e => setFormData({ ...formData, monto: e.target.value })}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="label-field">Observación</label>
                                    <textarea
                                        className="input-field min-h-[80px]"
                                        value={formData.observacion}
                                        onChange={e => setFormData({ ...formData, observacion: e.target.value })}
                                        placeholder="Detalles sobre el canje o pago..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 mt-8">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2"
                                >
                                    <Save size={18} /> Guardar
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Payments;
