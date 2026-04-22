import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Users, Lock, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Settings = ({ userRole }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isCreatingUser, setIsCreatingUser] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');

    const modules = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'quotes', label: 'Cotizaciones' },
        { id: 'clients', label: 'Clientes' },
        { id: 'payments', label: 'Pagos y Canjes' },
        { id: 'services', label: 'Inventario' },
        { id: 'calendar', label: 'Calendario' },
    ];

    useEffect(() => {
        if (userRole === 'admin') {
            fetchUsers();

            const channel = supabase
                .channel('profiles-changes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                    fetchUsers();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [userRole]);

    const fetchUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePermission = async (userId, moduleId, currentPermissions) => {
        const perms = currentPermissions || [];
        const newPerms = perms.includes(moduleId)
            ? perms.filter(p => p !== moduleId)
            : [...perms, moduleId];

        // Optimistic update
        setUsers(users.map(u => u.id === userId ? { ...u, permissions: newPerms } : u));

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ permissions: newPerms })
                .eq('id', userId);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating permissions:', error);
            fetchUsers(); // Revert on error
        }
    };

    const handleToggleRole = async (userId, currentRole) => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        // Optimistic update
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating role:', error);
            fetchUsers(); // Revert on error
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setSaving(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            const { data, error } = await supabase.auth.signUp({
                email: newEmail,
                password: newPassword,
                options: {
                    data: {
                        full_name: newEmail.split('@')[0],
                    }
                }
            });

            if (error) throw error;

            setSuccessMsg(`Usuario ${newEmail} creado con éxito. Ya puede iniciar sesión.`);
            setNewEmail('');
            setNewPassword('');
            setIsCreatingUser(false);
            fetchUsers();
        } catch (error) {
            console.error('Error creating user:', error);
            setErrorMsg(error.message);
        } finally {
            setSaving(false);
            setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 5000);
        }
    };


    if (userRole !== 'admin') {
        return (
            <div className="p-8 text-center text-slate-500">
                <Lock className="mx-auto mb-4 opacity-50" size={32} />
                <p>No tienes permisos para ver esta sección.</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-800">Ajustes & Accesos</h1>
                    <p className="text-slate-500 font-medium mt-1">Administra quién puede entrar y ver qué módulos en el sistema.</p>
                </div>
                <button
                    onClick={() => setIsCreatingUser(!isCreatingUser)}
                    className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold tracking-wide hover:bg-slate-800 transition-colors shadow-premium"
                >
                    {isCreatingUser ? 'Cancelar' : 'Invitar Usuario'}
                </button>
            </div>

            <AnimatePresence>
                {isCreatingUser && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 32 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                            <h3 className="font-bold text-slate-800 mb-4 pb-4 border-b">Crear Nuevo Usuario</h3>
                            <form onSubmit={handleCreateUser} className="flex items-end gap-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Email del Usuario</label>
                                    <input
                                        type="email"
                                        required
                                        value={newEmail}
                                        onChange={e => setNewEmail(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                                        placeholder="ejemplo@puntourbano.cl"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Contraseña Inicial</label>
                                    <input
                                        type="text"
                                        required
                                        minLength={6}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                                        placeholder="Min 6 caracteres"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 size={18} className="animate-spin" /> : 'Guardar y Crear'}
                                </button>
                            </form>

                            {errorMsg && <p className="text-red-500 text-sm mt-4 font-medium px-1">{errorMsg}</p>}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {successMsg && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 px-4 py-3 rounded-xl mb-6 font-medium text-sm flex items-center gap-2"
                    >
                        <CheckCircle2 size={18} />
                        {successMsg}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="card p-0 overflow-hidden shadow-premium">
                <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                            <Users size={20} />
                        </div>
                        <h3 className="font-bold text-slate-800">Usuarios Registrados</h3>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-200">
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuario / Email</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Rol de Sistema</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Permisos de Módulo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="3" className="px-6 py-8 text-center">
                                        <Loader2 className="animate-spin mx-auto text-blue-500 mb-2" />
                                        <span className="text-sm font-medium text-slate-500">Cargando usuarios...</span>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="px-6 py-8 text-center text-sm font-medium text-slate-500">
                                        No hay usuarios registrados aparte del sistema base.
                                    </td>
                                </tr>
                            ) : (
                                users.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-5">
                                            <div className="font-bold text-slate-800">{user.email.split('@')[0]}</div>
                                            <div className="text-sm text-slate-500 mt-0.5">{user.email}</div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <button
                                                onClick={() => handleToggleRole(user.id, user.role)}
                                                disabled={user.email === 'admin@puntourbano.cl'}
                                                className={`px-3 py-1 text-xs font-bold tracking-wider uppercase rounded-full border transition-all ${user.role === 'admin'
                                                    ? 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200'
                                                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                                    } ${user.email === 'admin@puntourbano.cl' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                            >
                                                {user.role === 'admin' ? 'Administrador' : 'Solo Visualización'}
                                            </button>
                                        </td>
                                        <td className="px-6 py-5">
                                            {user.role === 'admin' ? (
                                                <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5 bg-slate-100 w-fit px-3 py-1.5 rounded-lg border">
                                                    <CheckCircle2 size={14} /> Acceso Total Incluido
                                                </span>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {modules.map(mod => {
                                                        const hasPerm = (user.permissions || []).includes(mod.id);
                                                        return (
                                                            <button
                                                                key={mod.id}
                                                                onClick={() => handleTogglePermission(user.id, mod.id, user.permissions)}
                                                                className={`px-3 py-1.5 text-xs font-bold transition-all rounded-lg border ${hasPerm
                                                                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                                                    : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600'
                                                                    }`}
                                                            >
                                                                {mod.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Settings;
