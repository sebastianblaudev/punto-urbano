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
    HelpCircle,
    Edit,
    Trash,
    Plus,
    Calendar as CalendarIcon,
    Loader2,
    Save
} from 'lucide-react';

const Calendar = ({ events, setEvents }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [isLoadingAction, setIsLoadingAction] = useState(false);

    // Initial Form State
    const initialFormState = {
        title: '',
        time: '09:00',
        type: 'confirmed',
        description: '',
        date: ''
    };
    const [eventFormData, setEventFormData] = useState(initialFormState);

    // --- Helpers ---
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
        // Start week on Monday
        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
        return { days, firstDay: adjustedFirstDay };
    };

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dayNames = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

    const getEventsForDay = (day) => {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return events.filter(e => e.date === dateStr);
    };

    const formatDate = (day) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        const dayNamesFull = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        return `${dayNamesFull[date.getDay()]} ${day} de ${monthNames[date.getMonth()]}`;
    };

    const getTypeStyles = (type, dateStr) => {
        const eventDate = new Date(dateStr + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (type === 'completed' || eventDate < today) {
            return {
                bg: 'bg-slate-200',
                text: 'text-slate-500',
                border: 'border-slate-300',
                icon: <CheckCircle size={14} />
            };
        }

        switch (type) {
            case 'confirmed': return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', icon: <CheckCircle size={14} /> };
            case 'tentative': return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', icon: <HelpCircle size={14} /> };
            case 'note': return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', icon: <AlertCircle size={14} /> };
            default: return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', icon: <Clock size={14} /> };
        }
    };

    const getTypeLabel = (type, dateStr) => {
        const eventDate = new Date(dateStr + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (type === 'completed' || eventDate < today) return 'Completado';

        switch (type) {
            case 'confirmed': return 'Confirmado';
            case 'tentative': return 'Provisorio';
            case 'note': return 'Nota';
            default: return 'Evento';
        }
    };

    const formatEventTitle = (evt) => {
        if (!evt || !evt.title) return '';
        // Flip old automatically generated events specifically based on their description footprint
        if (evt.description && evt.description.startsWith('Evento: ') && evt.description.includes(' - Cliente: ')) {
            const parts = evt.title.split(' - ');
            if (parts.length >= 2) {
                const firstPart = parts[0];
                const restPart = parts.slice(1).join(' - ');
                return `${restPart} - ${firstPart}`;
            }
        }
        return evt.title;
    };

    // --- Actions ---

    const openNewEventModal = (day) => {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        setEditingEvent(null);
        setEventFormData({ ...initialFormState, date: dateStr });
        setIsEventModalOpen(true);
    };

    const openEditEventModal = (event) => {
        setEditingEvent(event);
        setEventFormData(event);
        setIsEventModalOpen(true);
    };

    const handleSaveEvent = async (e) => {
        e.preventDefault();
        setIsLoadingAction(true);

        const eventToSave = { ...eventFormData };

        // Optimistic UI Update
        const tempId = Date.now();
        const optimisticEvent = { ...eventToSave, id: editingEvent ? editingEvent.id : tempId };

        const previousEvents = [...events];

        // 1. Update Local State Immediately
        if (editingEvent) {
            setEvents(prev => prev.map(ev => ev.id === editingEvent.id ? optimisticEvent : ev));
        } else {
            setEvents(prev => [...prev, optimisticEvent]);
        }

        // Close modal immediately for snappy feel
        setIsEventModalOpen(false);

        try {
            if (editingEvent) {
                const { error } = await supabase.from('events').update(eventToSave).eq('id', editingEvent.id);
                if (error) throw error;
                // Success - no need to do anything else as state is already updated
                // But we might want to update the ID if it was a create operation (handled below)
            } else {
                const { data, error } = await supabase.from('events').insert([eventToSave]).select();
                if (error) throw error;
                // Replace temp ID with real ID
                if (data && data[0]) {
                    setEvents(prev => prev.map(ev => ev.id === tempId ? data[0] : ev));
                }
            }

            // Sync Selected Date View
            if (selectedDate) {
                // Re-calculate events for the currently open day view
                const day = parseInt(eventToSave.date.split('-')[2]);
                // We need to wait for the state update or just pass the new list. 
                // Simple approach: Close the day detail to refresh or update it manually.
                // Let's rely on the main `events` prop update to propagate.
                // Actually, we need to update selectedDate.events too
                const updatedList = editingEvent
                    ? events.map(ev => ev.id === editingEvent.id ? optimisticEvent : ev)
                    : [...events, optimisticEvent];

                setSelectedDate(prev => ({
                    ...prev,
                    events: updatedList.filter(ev => ev.date === eventToSave.date)
                }));
            }

        } catch (error) {
            console.error('Error saving event:', error);
            alert('Error al guardar el evento. Se revertirán los cambios.');
            setEvents(previousEvents); // Revert
        } finally {
            setIsLoadingAction(false);
        }
    };

    const handleDeleteEvent = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar este evento?')) return;

        const previousEvents = [...events];
        setEvents(prev => prev.filter(ev => ev.id !== id)); // Optimistic delete

        if (selectedDate) {
            setSelectedDate(prev => ({
                ...prev,
                events: prev.events.filter(ev => ev.id !== id)
            }));
        }

        try {
            const { error } = await supabase.from('events').delete().eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error('Error deleting event:', error);
            alert('Error al eliminar. Se revertirán los cambios.');
            setEvents(previousEvents); // Revert
            if (selectedDate) {
                // Revert selected date events too... ideally just re-open or fetch
                const day = new Date(previousEvents.find(e => e.id === id).date).getDate();
                setSelectedDate({ day, events: previousEvents.filter(e => e.date === previousEvents.find(ev => ev.id === id).date) });
            }
        }
    };

    const handleMarkCompleted = async () => {
        setEventFormData(prev => ({ ...prev, type: 'completed' }));
        // Trigger save with status update (handled by form submit usually, but here manually)
        // We'll just update state and submit
        const eventToSave = { ...eventFormData, type: 'completed' };
        // Reuse handleSaveEvent logic but cleaner to direct call if we could refactor
        // For now, update state and simulate submit or reuse logic structure
        setEditingEvent(prev => ({ ...prev, type: 'completed' }));

        // Reuse the save logic manually:
        setIsLoadingAction(true);
        try {
            const { error } = await supabase.from('events').update({ type: 'completed' }).eq('id', editingEvent.id);
            if (error) throw error;

            setEvents(prev => prev.map(ev => ev.id === editingEvent.id ? { ...ev, type: 'completed' } : ev));
            setIsEventModalOpen(false);
            if (selectedDate) {
                setSelectedDate(prev => ({
                    ...prev,
                    events: prev.events.map(ev => ev.id === editingEvent.id ? { ...ev, type: 'completed' } : ev)
                }));
            }
        } catch (error) {
            console.error('Error marking completed', error);
        } finally {
            setIsLoadingAction(false);
        }
    };


    // --- Render ---

    const { days: totalDays, firstDay } = getDaysInMonth(currentDate);
    const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

    return (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
            {/* Header */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">Calendario Maestro</h1>
                    <p className="text-gray-500 font-medium">Gestión de operaciones y logística.</p>
                </div>
                <div className="flex items-center gap-4 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
                    <button
                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                        className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-blue-600 transition-colors"
                    >
                        <ChevronLeft size={20} strokeWidth={2.5} />
                    </button>
                    <span className="px-4 font-black text-slate-800 uppercase tracking-widest text-sm w-44 text-center">
                        {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </span>
                    <button
                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                        className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-blue-600 transition-colors"
                    >
                        <ChevronRight size={20} strokeWidth={2.5} />
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="card p-0 overflow-hidden shadow-premium bg-white" style={{ border: 'none' }}>
                {/* Days Header */}
                <div className="grid grid-cols-7 bg-slate-50/80 border-b border-slate-100 backdrop-blur-sm">
                    {dayNames.map(day => (
                        <div key={day} className="py-4 text-center text-[0.65rem] font-black uppercase tracking-widest text-slate-400">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 auto-rows-fr bg-slate-100 gap-[1px]">
                    {/* Empty cells for previous month */}
                    {emptyDays.map(i => <div key={`empty-${i}`} className="bg-slate-50/50 min-h-[140px]"></div>)}

                    {/* Actual Days */}
                    {daysArray.map(day => {
                        const dayEvents = getEventsForDay(day);
                        const today = new Date();
                        const isToday = day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();

                        return (
                            <div
                                key={day}
                                onClick={() => setSelectedDate({ day, events: dayEvents })}
                                className={`bg-white min-h-[140px] p-3 flex flex-col gap-2 transition-all hover:bg-blue-50/20 cursor-pointer group relative ${selectedDate?.day === day ? 'bg-blue-50/50' : ''}`}
                            >
                                <div className="flex justify-between items-start">
                                    <span className={`text-sm font-black w-8 h-8 flex items-center justify-center rounded-xl transition-all ${isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50'}`}>
                                        {day}
                                    </span>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); openNewEventModal(day); }}
                                        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white transition-all text-slate-400"
                                    >
                                        <Plus size={14} strokeWidth={3} />
                                    </button>
                                </div>

                                <div className="flex flex-col gap-1.5 mt-1">
                                    {dayEvents.slice(0, 4).map((evt, idx) => {
                                        const styles = getTypeStyles(evt.type, evt.date);
                                        return (
                                            <div key={idx} className={`text-[0.6rem] font-bold px-2 py-1.5 rounded-lg border-l-2 truncate flex items-center gap-1.5 ${styles.bg} ${styles.text} ${styles.border} shadow-sm`} title={formatEventTitle(evt)}>
                                                {/* <div className={`w-1.5 h-1.5 rounded-full ${styles.text.replace('text', 'bg')}`}></div> */}
                                                {formatEventTitle(evt)}
                                            </div>
                                        );
                                    })}
                                    {dayEvents.length > 4 && (
                                        <span className="text-[0.6rem] font-black text-slate-400 pl-1 uppercase tracking-wider">+{dayEvents.length - 4} más</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Event Details Popup */}
            <AnimatePresence>
                {selectedDate && (
                    <div className="modal-overlay overflow-y-auto px-6 py-12" onClick={() => setSelectedDate(null)}>
                        <motion.div
                            initial={{ scale: 0.98, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.98, opacity: 0, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white w-full !max-w-[700px] rounded-[2.5rem] shadow-[0_48px_80px_-16px_rgba(0,0,0,0.12)] overflow-hidden mx-auto border border-slate-100"
                            style={{ maxWidth: '700px' }}
                        >
                            {/* Unified Header Section */}
                            <div className="relative overflow-hidden bg-slate-900 group/header">
                                {/* Abstract background patterns */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-[100px] rounded-full -mr-32 -mt-32"></div>
                                <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-600/10 blur-[80px] rounded-full -ml-24 -mb-24"></div>

                                <div className="relative px-16 py-12 pb-10">
                                    <div className="flex justify-between items-start mb-12">
                                        <div className="flex gap-8 items-center">
                                            <div className="text-center bg-white/10 backdrop-blur-md px-6 py-4 rounded-[2rem] border border-white/10 shadow-2xl">
                                                <span className="block text-[0.65rem] font-black text-blue-400 uppercase tracking-[0.4em] mb-1">{formatDate(selectedDate.day).split(' ')[0]}</span>
                                                <h2 className="text-6xl font-black text-white tracking-tighter tabular-nums leading-none">
                                                    {selectedDate.day}
                                                </h2>
                                            </div>
                                            <div>
                                                <h3 className="text-3xl font-black text-white tracking-tight uppercase mb-1">
                                                    {monthNames[currentDate.getMonth()]}
                                                </h3>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-slate-400 font-bold text-sm uppercase tracking-[0.3em]">{currentDate.getFullYear()}</span>
                                                    <div className="w-1 h-1 rounded-full bg-slate-600"></div>
                                                    <span className="text-blue-400 font-black text-xs uppercase tracking-widest">{selectedDate.events.length} ACTIVIDADES</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setSelectedDate(null)}
                                            className="p-4 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-2xl transition-all text-white/40 hover:text-white border border-white/10 group-hover/header:rotate-90 duration-500"
                                        >
                                            <X size={24} />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex -space-x-2">
                                            {/* decorative dots representing events */}
                                            {selectedDate.events.slice(0, 5).map((_, i) => (
                                                <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[0.6rem] font-black text-slate-400">
                                                    {i + 1}
                                                </div>
                                            ))}
                                            {selectedDate.events.length > 5 && (
                                                <div className="w-8 h-8 rounded-full border-2 border-slate-900 bg-blue-600 flex items-center justify-center text-[0.6rem] font-black text-white">
                                                    +{selectedDate.events.length - 5}
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => { setSelectedDate(null); openNewEventModal(selectedDate.day); }}
                                            className="group/btn flex items-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all active:scale-95 text-[0.7rem] uppercase tracking-[0.2em] shadow-xl shadow-blue-900/40 border-none"
                                        >
                                            <Plus size={18} strokeWidth={3} className="group-hover/btn:rotate-180 transition-transform duration-500" /> Nuevo Registro
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Main Content Area: Timeline Experience */}
                            <div className="relative px-20 py-12 bg-white">
                                {/* The Timeline Line */}
                                {selectedDate.events.length > 1 && (
                                    <div className="absolute left-[85px] top-[60px] bottom-[60px] w-0.5 bg-slate-100 hidden sm:block"></div>
                                )}

                                {selectedDate.events.length === 0 ? (
                                    <div className="py-24 flex flex-col items-center justify-center text-slate-300">
                                        <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                                            <CalendarIcon size={32} strokeWidth={1.5} className="opacity-40" />
                                        </div>
                                        <p className="text-[0.7rem] font-black uppercase tracking-[0.4em] text-slate-400">Sin actividades agendadas</p>
                                    </div>
                                ) : (
                                    <div className="space-y-8 relative">
                                        {selectedDate.events.sort((a, b) => a.time.localeCompare(b.time)).map((evt, idx) => {
                                            const style = getTypeStyles(evt.type, evt.date);
                                            return (
                                                <motion.div
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: idx * 0.1 }}
                                                    key={evt.id}
                                                    className="relative flex gap-8 group"
                                                >
                                                    {/* Time & Marker Column */}
                                                    <div className="flex flex-col items-center gap-3 pt-1 w-20 shrink-0">
                                                        <span className="text-[0.65rem] font-black text-slate-400 tabular-nums uppercase tracking-widest">{evt.time}</span>
                                                        <div className={`w-4 h-4 rounded-full border-4 border-white shadow-md z-10 transition-transform group-hover:scale-125 ${style.bg.replace('bg-', 'bg-').split(' ')[0]} ${style.text.replace('text-', 'bg-').split(' ')[0]}`}></div>
                                                    </div>

                                                    {/* Event Card */}
                                                    <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm group-hover:shadow-xl group-hover:-translate-y-1 transition-all duration-300">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className="flex items-center gap-3">
                                                                <span className={`text-[0.55rem] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
                                                                    {getTypeLabel(evt.type, evt.date)}
                                                                </span>
                                                                {evt.type === 'completed' && (
                                                                    <div className="flex items-center gap-1 text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-md">
                                                                        <CheckCircle size={12} />
                                                                        <span className="text-[0.5rem] font-black uppercase">Finalizado</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); openEditEventModal(evt); }}
                                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                                                >
                                                                    <Edit size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteEvent(evt.id); }}
                                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                                >
                                                                    <Trash size={16} />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <h4 className="text-xl font-black text-slate-900 leading-tight mb-4 uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                                                            {formatEventTitle(evt)}
                                                        </h4>

                                                        {evt.description && (
                                                            <div className="bg-slate-50/50 p-5 rounded-[1.5rem] text-[0.85rem] text-slate-500 font-medium leading-relaxed border border-dashed border-slate-200">
                                                                {evt.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>




            {/* Create/Edit Modal */}
            <AnimatePresence>
                {isEventModalOpen && (
                    <div className="modal-overlay" onClick={() => setIsEventModalOpen(false)}>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
                        >
                            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h2 className="text-xl font-black text-slate-800">
                                    {editingEvent ? 'Editar Evento' : 'Nuevo Evento'}
                                </h2>
                                <button onClick={() => setIsEventModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveEvent} className="p-8 space-y-6">
                                <div>
                                    <label className="label-field">Título del Evento</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Ej: Montaje Evento Coca Cola"
                                        className="input-field"
                                        value={eventFormData.title}
                                        onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label-field">Hora</label>
                                        <input
                                            type="time"
                                            className="input-field"
                                            value={eventFormData.time}
                                            onChange={(e) => setEventFormData({ ...eventFormData, time: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="label-field">Tipo</label>
                                        <select
                                            className="input-field"
                                            value={eventFormData.type}
                                            onChange={(e) => setEventFormData({ ...eventFormData, type: e.target.value })}
                                        >
                                            <option value="confirmed">Confirmado</option>
                                            <option value="tentative">Provisorio</option>
                                            <option value="note">Nota</option>
                                            <option value="completed">Completado</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="label-field">Notas / Descripción</label>
                                    <textarea
                                        rows="3"
                                        placeholder="Detalles adicionales, encargado, dirección..."
                                        className="input-field"
                                        value={eventFormData.description}
                                        onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                                    ></textarea>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    {editingEvent && editingEvent.type !== 'completed' && (
                                        <button
                                            type="button"
                                            onClick={handleMarkCompleted}
                                            className="px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-2"
                                            disabled={isLoadingAction}
                                        >
                                            <CheckCircle size={18} /> Completar
                                        </button>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isLoadingAction}
                                        className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {isLoadingAction ? (
                                            <Loader2 size={20} className="animate-spin" />
                                        ) : (
                                            <>
                                                <Save size={18} /> Guardar
                                            </>
                                        )}
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

export default Calendar;
