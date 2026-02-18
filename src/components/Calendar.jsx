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
                                            <div key={idx} className={`text-[0.6rem] font-bold px-2 py-1.5 rounded-lg border-l-2 truncate flex items-center gap-1.5 ${styles.bg} ${styles.text} ${styles.border} shadow-sm`}>
                                                {/* <div className={`w-1.5 h-1.5 rounded-full ${styles.text.replace('text', 'bg')}`}></div> */}
                                                {evt.title}
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

            {/* Event Details Drawer (Right Side) */}
            <AnimatePresence>
                {selectedDate && (
                    <div className="modal-overlay" style={{ justifyContent: 'flex-end', padding: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)' }} onClick={() => setSelectedDate(null)}>
                        <motion.div
                            initial={{ x: '100%', opacity: 0.5 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0.5 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-full w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col border-l border-white/20"
                        >
                            {/* Drawer Header */}
                            <div className="relative bg-slate-900 px-8 py-8 overflow-hidden shrink-0">
                                <div className="absolute top-0 right-0 p-6 opacity-5">
                                    <CalendarIcon size={200} />
                                </div>

                                <button
                                    onClick={() => setSelectedDate(null)}
                                    className="absolute top-6 left-6 flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-xl transition-all active:scale-95 bg-white/5 border border-white/10 text-white group z-20"
                                >
                                    <ChevronLeft size={16} className="text-blue-400 group-hover:-translate-x-1 transition-transform" />
                                    <span className="text-[0.6rem] font-black uppercase tracking-widest">Volver</span>
                                </button>

                                <div className="mt-8 relative z-10">
                                    <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-2">{formatDate(selectedDate.day).split(' ')[1]}</h2>
                                    <p className="text-blue-400 font-bold uppercase tracking-widest text-xs">
                                        {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                                    </p>
                                    <p className="text-slate-400 text-sm mt-4 font-medium flex items-center gap-2">
                                        <AlignLeft size={16} />
                                        {selectedDate.events.length} Eventos programados
                                    </p>

                                    <button
                                        onClick={() => { setSelectedDate(null); openNewEventModal(selectedDate.day); }}
                                        className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/50 flex items-center justify-center gap-2 transition-all active:scale-95"
                                    >
                                        <Plus size={18} strokeWidth={3} /> Agregar Evento
                                    </button>
                                </div>
                            </div>

                            {/* Drawer Content */}
                            <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-4">
                                {selectedDate.events.length === 0 ? (
                                    <div className="h-40 flex flex-col items-center justify-center text-slate-400 gap-4 opacity-50">
                                        <CalendarIcon size={48} strokeWidth={1} />
                                        <span className="text-sm font-medium">No hay eventos para este día</span>
                                    </div>
                                ) : (
                                    selectedDate.events.map((evt, idx) => {
                                        const style = getTypeStyles(evt.type, evt.date);
                                        return (
                                            <motion.div
                                                layoutId={evt.id}
                                                key={evt.id}
                                                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group"
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className={`px-2.5 py-1 rounded-lg text-[0.6rem] font-black uppercase tracking-widest flex items-center gap-1.5 ${style.bg} ${style.text}`}>
                                                        {style.icon}
                                                        {getTypeLabel(evt.type, evt.date)}
                                                    </div>
                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                        <button onClick={() => openEditEventModal(evt)} className="p-1.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={14} /></button>
                                                        <button onClick={() => handleDeleteEvent(evt.id)} className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash size={14} /></button>
                                                    </div>
                                                </div>

                                                <h3 className="font-bold text-slate-800 text-lg leading-tight mb-2">{evt.title}</h3>

                                                <div className="flex items-center gap-4 text-xs font-bold text-slate-400 mb-4">
                                                    <span className="flex items-center gap-1"><Clock size={12} /> {evt.time}</span>
                                                    {/* <span className="flex items-center gap-1"><MapPin size={12} /> Ubicación</span> */}
                                                </div>

                                                {evt.description && (
                                                    <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-500 font-medium leading-relaxed border border-slate-100">
                                                        {evt.description}
                                                    </div>
                                                )}
                                            </motion.div>
                                        );
                                    })
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
