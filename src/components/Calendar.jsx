import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft,
    ChevronRight,
    X,
    Clock,
    MapPin,
    AlignLeft,
    CheckCircle,
    AlertCircle,
    Edit,
    Trash,
    Plus,
    Users,
    Save,
    Calendar as CalendarIcon
} from 'lucide-react';
import { createPortal } from 'react-dom';

const Calendar = ({ events, setEvents }) => {
    const [currentDate, setCurrentDate] = useState(new Date(2026, 1, 1)); // Feb 2026 for demo
    const [selectedDate, setSelectedDate] = useState(null);
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);


    const [eventFormData, setEventFormData] = useState({
        title: '',
        time: '09:00 AM',
        type: 'confirmed',
        description: '',
        date: ''
    });

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
        // Adjust for Monday start (0 = Mon, 6 = Sun)
        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
        return { days, firstDay: adjustedFirstDay };
    };

    const { days: totalDays, firstDay } = getDaysInMonth(currentDate);
    const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dayNames = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

    const getEventsForDay = (day) => {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return events.filter(e => e.date === dateStr);
    };

    const formatDate = (day) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const dayNamesFull = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const dayName = dayNamesFull[date.getDay()];
        return `${dayName} ${day} de ${monthNames[date.getMonth()]}`;
    };

    const getColor = (type) => {
        switch (type) {
            case 'confirmed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'note': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'past': return 'bg-slate-100 text-slate-500 border-slate-200';
            default: return 'bg-blue-100 text-blue-700';
        }
    };

    // CRUD Handlers
    const openNewEventModal = (day) => {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        setEditingEvent(null);
        setEventFormData({
            title: '',
            time: '09:00 AM',
            type: 'confirmed',
            description: '',
            date: dateStr
        });
        setIsEventModalOpen(true);
    };

    const openEditEventModal = (event) => {
        setEditingEvent(event);
        setEventFormData(event);
        setIsEventModalOpen(true);
    };



    const handleSaveEvent = async (e) => {
        e.preventDefault();
        try {
            const eventToSave = { ...eventFormData };
            if (!editingEvent) {
                // New event
                const { data, error } = await supabase.from('events').insert([eventToSave]).select();
                if (error) throw error;
                if (data) setEvents([...events, ...data]);
            } else {
                // Edit event
                const { error } = await supabase.from('events').update(eventToSave).eq('id', editingEvent.id);
                if (error) throw error;
                setEvents(events.map(ev => ev.id === editingEvent.id ? { ...ev, ...eventToSave } : ev));
            }

            setIsEventModalOpen(false);

            // Update selected date view locally
            if (selectedDate) {
                // Re-fetch or simple local update 
                // Simple local update for responsiveness
                const dateStr = eventToSave.date;
                const updatedList = (!editingEvent)
                    ? [...events, eventToSave]
                    : events.map(ev => ev.id === editingEvent.id ? { ...ev, ...eventToSave } : ev);

                setSelectedDate({
                    ...selectedDate,
                    events: updatedList.filter(ev => ev.date === dateStr)
                });
            }
        } catch (error) {
            console.error('Error saving event:', error);
            alert('Error al guardar evento');
        }
    };

    const handleDeleteEvent = async (id) => {
        if (window.confirm('¿Estás seguro de eliminar este registro?')) {
            try {
                const { error } = await supabase.from('events').delete().eq('id', id);
                if (error) throw error;

                const updatedEvents = events.filter(ev => ev.id !== id);
                setEvents(updatedEvents);
                if (selectedDate) {
                    setSelectedDate({
                        ...selectedDate,
                        events: updatedEvents.filter(ev => ev.date === selectedDate.events[0]?.date)
                    });
                }
            } catch (error) {
                console.error('Error deleting event:', error);
                alert('Error al eliminar evento');
            }
        }
    };

    return (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-black">Calendario Maestro</h1>
                    <p className="text-gray-500 font-medium">Operaciones, logística y recordatorios en un solo lugar.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-white rounded-xl shadow-sm border border-slate-200 p-1">
                        <button
                            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                            className="p-2 hover:bg-slate-50 rounded-lg text-slate-500"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="px-4 font-black text-slate-700 uppercase tracking-widest text-sm w-40 text-center">
                            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </span>
                        <button
                            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                            className="p-2 hover:bg-slate-50 rounded-lg text-slate-500"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="card p-0 overflow-hidden shadow-premium" style={{ border: 'none' }}>
                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                    {dayNames.map(day => (
                        <div key={day} className="py-4 text-center text-xs font-black uppercase tracking-widest text-slate-400">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 auto-rows-fr bg-slate-200 gap-[1px]">
                    {emptyDays.map(i => <div key={`empty-${i}`} className="bg-slate-50/50 min-h-[120px]"></div>)}

                    {daysArray.map(day => {
                        const dayEvents = getEventsForDay(day);
                        const today = new Date();
                        const isToday = day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();

                        return (
                            <div
                                key={day}
                                onClick={() => setSelectedDate({ day, events: dayEvents })}
                                className="bg-white min-h-[120px] p-3 flex flex-col gap-2 transition-all hover:bg-blue-50/30 cursor-pointer group relative"
                            >
                                <div className="flex justify-between items-start">
                                    <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-colors ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-slate-700 group-hover:bg-slate-100'}`}>
                                        {day}
                                    </span>
                                    {dayEvents.length > 0 && (
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-1 mt-1">
                                    {dayEvents.slice(0, 3).map((evt, idx) => (
                                        <div key={idx} className={`text-[0.6rem] font-bold px-2 py-1 rounded-md border-l-2 truncate ${getColor(evt.type)}`}>
                                            {evt.title}
                                        </div>
                                    ))}
                                    {dayEvents.length > 3 && (
                                        <span className="text-[0.6rem] font-black text-slate-400 pl-1">+{dayEvents.length - 3} más</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Event Details Drawer */}
            <AnimatePresence>
                {selectedDate && (
                    <div className="modal-overlay" style={{ justifyContent: 'flex-end', padding: 0 }} onClick={() => setSelectedDate(null)}>
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-full w-full max-w-lg bg-white shadow-[-20px_0_50px_rgba(0,0,0,0.1)] overflow-y-auto flex flex-col"
                        >
                            <div className="p-8 pb-12 bg-slate-900 text-white relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="flex justify-between items-center mb-8">
                                        <button onClick={() => setSelectedDate(null)} className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-xl transition-all active:scale-95 bg-white/5 border border-white/10 text-white group">
                                            <ChevronLeft size={18} className="text-blue-400 group-hover:-translate-x-1 transition-transform" />
                                            <span className="text-[0.6rem] font-black uppercase tracking-widest">Volver</span>
                                        </button>
                                        <p className="text-blue-400 font-bold uppercase tracking-[0.3em] text-[0.6rem] bg-blue-500/10 px-4 py-1.5 rounded-full border border-blue-500/20">Detalle de Operaciones</p>
                                    </div>
                                    <h2 className="text-3xl font-black tracking-tight leading-none">{formatDate(selectedDate.day)}</h2>
                                </div>
                                <div className="absolute top-1/2 right-0 -translate-y-1/2 p-4 text-white opacity-[0.03] pointer-events-none translate-x-1/4">
                                    <CalendarIcon size={160} strokeWidth={2} />
                                </div>
                            </div>

                            <div className="p-8 space-y-10 flex-1 bg-slate-50/50">
                                {selectedDate.events.length > 0 ? (
                                    <div className="relative">
                                        <div className="absolute left-[15px] top-4 bottom-4 w-px bg-slate-100"></div>
                                        <div className="space-y-12 relative">
                                            {selectedDate.events.map((evt, idx) => (
                                                <div key={idx} className="relative pl-12">
                                                    <div className={`absolute left-0 top-0 w-8 h-8 rounded-xl shadow-lg border-2 border-white flex items-center justify-center z-10 ${evt.type === 'confirmed' ? 'bg-emerald-500' : evt.type === 'note' ? 'bg-amber-500' : 'bg-slate-400'
                                                        }`}>
                                                        {evt.type === 'confirmed' && <CheckCircle size={14} className="text-white" />}
                                                        {evt.type === 'note' && <AlertCircle size={14} className="text-white" />}
                                                        {evt.type === 'past' && <Clock size={14} className="text-white" />}
                                                    </div>

                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">{evt.time}</span>
                                                            <span className={`px-2 py-1 rounded text-[0.6rem] font-black uppercase tracking-widest ${evt.type === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                                                                evt.type === 'note' ? 'bg-amber-100 text-amber-700' :
                                                                    'bg-slate-100 text-slate-500'
                                                                }`}>
                                                                {evt.type === 'confirmed' ? 'Confirmado' : evt.type === 'note' ? 'Nota' : 'Finalizado'}
                                                            </span>
                                                        </div>

                                                        <div className="group bg-white hover:shadow-2xl hover:shadow-slate-200 border border-slate-100 p-6 rounded-3xl transition-all">
                                                            <div className="flex justify-between items-start mb-3">
                                                                <h3 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{evt.title}</h3>
                                                                <div className="flex gap-2">
                                                                    <button onClick={() => openEditEventModal(evt)} className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><Edit size={16} /></button>
                                                                    <button onClick={() => handleDeleteEvent(evt.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash size={16} /></button>
                                                                </div>
                                                            </div>
                                                            <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6">{evt.description}</p>

                                                            <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-50">
                                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                                                    <MapPin size={14} className="text-blue-500" />
                                                                    Ubicación del evento
                                                                </div>
                                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                                                    <Users size={14} className="text-emerald-500" />
                                                                    Encargado: Eric G.
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-20">
                                        <AlignLeft size={80} strokeWidth={1} className="mb-4" />
                                        <p className="font-black text-slate-900 uppercase tracking-widest text-sm">Sin Actividad</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-8 bg-white border-t border-slate-100">
                                <button
                                    onClick={() => openNewEventModal(selectedDate.day)}
                                    className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl shadow-slate-200"
                                >
                                    <Plus size={18} />
                                    Nuevo Registro
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Event Edit/New Modal */}
            <AnimatePresence>
                {isEventModalOpen && createPortal(
                    <div className="modal-overlay" onClick={() => setIsEventModalOpen(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
                        >
                            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                                <h3 className="font-black text-xl tracking-tight">
                                    {editingEvent ? 'Editar Registro' : 'Nuevo Registro'}
                                </h3>
                                <button onClick={() => setIsEventModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveEvent} className="p-8 space-y-6">
                                <div>
                                    <label className="label-field">Título del Evento / Nota</label>
                                    <input
                                        required
                                        className="input-field font-bold"
                                        value={eventFormData.title}
                                        onChange={e => setEventFormData({ ...eventFormData, title: e.target.value })}
                                        placeholder="Ej: Montaje Evento SONO"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label-field">Hora</label>
                                        <input
                                            type="text"
                                            className="input-field font-bold"
                                            value={eventFormData.time}
                                            onChange={e => setEventFormData({ ...eventFormData, time: e.target.value })}
                                            placeholder="09:00 AM"
                                        />
                                    </div>
                                    <div>
                                        <label className="label-field">Tipo</label>
                                        <select
                                            className="input-field font-bold"
                                            value={eventFormData.type}
                                            onChange={e => setEventFormData({ ...eventFormData, type: e.target.value })}
                                        >
                                            <option value="confirmed">Confirmado</option>
                                            <option value="note">Nota / Pendiente</option>
                                            <option value="past">Finalizado</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="label-field">Descripción / Instrucciones</label>
                                    <textarea
                                        className="input-field min-h-[100px] font-medium"
                                        value={eventFormData.description}
                                        onChange={e => setEventFormData({ ...eventFormData, description: e.target.value })}
                                        placeholder="Detalles importantes del montaje o logística..."
                                    />
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsEventModalOpen(false)}
                                        className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-2 px-8 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                                    >
                                        <Save size={18} />
                                        {editingEvent ? 'Actualizar' : 'Crear Registro'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>,
                    document.body
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default Calendar;
