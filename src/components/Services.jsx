import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Package, Tag, Plus, FileUp, Edit, Trash, X, Save, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Services = () => {
    // --- State Management ---
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('Todos');

    const [inventory, setInventory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch Inventory
    useEffect(() => {
        fetchInventory();
    }, []);

    const fetchInventory = async () => {
        try {
            const { data, error } = await supabase.from('inventory').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setInventory(data || []);
        } catch (error) {
            console.error('Error fetching inventory:', error);
            alert('Error al cargar inventario');
        } finally {
            setIsLoading(false);
        }
    };

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        category: 'Lounge',
        price: '',
        stock: ''
    });

    // --- Actions ---
    const openModal = (item = null) => {
        setEditingItem(item);
        if (item) {
            setFormData({
                code: item.code,
                name: item.name,
                category: item.category,
                price: item.price,
                stock: item.stock
            });
        } else {
            setFormData({
                code: '',
                name: '',
                category: 'Lounge',
                price: '',
                stock: ''
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const itemData = {
            code: formData.code,
            name: formData.name,
            category: formData.category,
            price: Number(formData.price),
            stock: Number(formData.stock)
        };

        try {
            if (editingItem) {
                const { error } = await supabase.from('inventory').update(itemData).eq('id', editingItem.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('inventory').insert([itemData]);
                if (error) throw error;
            }
            fetchInventory();
            closeModal();
        } catch (error) {
            console.error('Error saving item:', error);
            alert('Error al guardar ítem');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este ítem?')) {
            try {
                const { error } = await supabase.from('inventory').delete().eq('id', id);
                if (error) throw error;
                setInventory(inventory.filter(item => item.id !== id));
            } catch (error) {
                console.error('Error deleting item:', error);
                alert('Error al eliminar ítem');
            }
        }
    };

    // Filter Logic
    const filteredInventory = inventory.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = activeCategory === 'Todos' || item.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    const categories = ['Todos', 'Lounge', 'Accesorios', 'Deco', 'Extras', 'Logística'];

    return (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            {/* Header */}
            <div className="flex justify-between items-end mb-10">
                <div>
                    <h1 className="text-3xl font-black">Inventario</h1>
                    <p className="text-slate-500 font-medium tracking-tight">Gestión de mobiliario, decoración y logística.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => openModal()}
                        className="flex items-center gap-3 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 hover:shadow-lg shadow-blue-500/20 transition-all border-none"
                    >
                        <Plus size={20} strokeWidth={3} /> <span className="text-base">Nuevo Ítem</span>
                    </button>
                    <button className="flex items-center gap-3 px-8 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all border-none">
                        <FileUp size={20} strokeWidth={3} /> <span className="text-base">Cargar Excel</span>
                    </button>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="mb-8 flex flex-col md:flex-row gap-6 justify-between items-center">
                <div className="flex gap-2 bg-slate-100 p-1.5 rounded-xl">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeCategory === cat
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="relative w-full md:w-auto min-w-[300px] group">
                    <input
                        type="text"
                        placeholder="Buscar por nombre o código..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input-field h-[48px] shadow-sm"
                    />
                </div>
            </div>

            {/* Inventory List */}
            <div className="card overflow-hidden shadow-flat" style={{ padding: '0', border: 'none' }}>
                <table className="data-table w-full">
                    <thead>
                        <tr className="text-left bg-slate-50/50 border-b border-slate-100">
                            <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">CÓDIGO</th>
                            <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">NOMBRE</th>
                            <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">CATEGORÍA</th>
                            <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">STOCK</th>
                            <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">VALOR NETO</th>
                            <th className="py-6 px-8 text-[0.65rem] font-black text-slate-400 uppercase tracking-widest text-right">ACCIONES</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredInventory.map((item) => (
                            <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-all">
                                <td className="py-6 px-8 font-black text-slate-400 text-xs">{item.code}</td>
                                <td className="py-6 px-8">
                                    <span className="font-bold text-slate-700">{item.name}</span>
                                </td>
                                <td className="py-6 px-8">
                                    <span className={`px-3 py-1 rounded-lg text-[0.65rem] font-black uppercase tracking-wide
                                        ${item.category === 'Lounge' ? 'bg-purple-50 text-purple-600' :
                                            item.category === 'Accesorios' ? 'bg-pink-50 text-pink-600' :
                                                item.category === 'Deco' ? 'bg-amber-50 text-amber-600' :
                                                    item.category === 'Extras' ? 'bg-cyan-50 text-cyan-600' :
                                                        'bg-slate-100 text-slate-600'
                                        }`}
                                    >
                                        {item.category}
                                    </span>
                                </td>
                                <td className="py-6 px-8">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${item.stock > 0 ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                                        <span className="font-bold text-slate-600 text-sm">{item.stock}</span>
                                    </div>
                                </td>
                                <td className="py-6 px-8 font-black text-slate-900">${item.price.toLocaleString()}</td>
                                <td className="py-6 px-8">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => openModal(item)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredInventory.length === 0 && (
                            <tr>
                                <td colSpan="6" className="py-12 text-center text-slate-400 font-medium">No se encontraron ítems.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="modal-overlay" onClick={closeModal}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                        >
                            <div className="px-8 py-6 bg-white border-b border-slate-50 flex justify-between items-center">
                                <h3 className="font-black text-xl text-slate-900">
                                    {editingItem ? 'Editar Ítem' : 'Nuevo Ítem'}
                                </h3>
                                <button onClick={closeModal} className="text-slate-300 hover:text-slate-500 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="p-8 space-y-5">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-1">
                                        <label className="label-field">Código</label>
                                        <input
                                            type="text"
                                            required
                                            className="input-field font-bold uppercase"
                                            value={formData.code}
                                            onChange={e => setFormData({ ...formData, code: e.target.value })}
                                            placeholder="LNG01"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="label-field">Categoría</label>
                                        <select
                                            className="input-field font-bold"
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        >
                                            {categories.filter(c => c !== 'Todos').map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="label-field">Nombre</label>
                                    <input
                                        type="text"
                                        required
                                        className="input-field font-bold"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Ej: Sofá Chesterfield"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label-field">Valor Neto</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                                            <input
                                                type="number"
                                                required
                                                className="input-field pl-7 font-bold"
                                                value={formData.price}
                                                onChange={e => setFormData({ ...formData, price: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label-field">Stock</label>
                                        <input
                                            type="number"
                                            required
                                            className="input-field font-bold"
                                            value={formData.stock}
                                            onChange={e => setFormData({ ...formData, stock: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="pt-6 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm border-none shadow-lg shadow-blue-500/20"
                                    >
                                        <Save size={18} /> Guardar Ítem
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default Services;
