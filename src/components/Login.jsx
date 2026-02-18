import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, ArrowRight, Sofa, CheckCircle2 } from 'lucide-react';

const Login = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: email.split('@')[0], // Default name
                        }
                    }
                });
                if (error) throw error;
                setSuccessMessage('¡Cuenta creada! Revisa tu correo.');
                setIsSignUp(false);
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (error) {
            console.error('Error authentication:', error);
            setError(error.message === 'Invalid login credentials'
                ? 'Credenciales incorrectas.'
                : error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0f172a] font-['Outfit'] p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{ maxWidth: '500px', width: '100%' }}
                className="w-full max-w-sm overflow-hidden p-6 sm:p-8 bg-slate-900 rounded-3xl shadow-2xl"
            >
                <div className="flex flex-col items-center mb-8">
                    <div className="mb-4">
                        <Sofa className="text-white" size={48} strokeWidth={2} />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tighter flex items-center gap-1">
                        PUNTO<span className="font-light text-slate-300">URBANO</span>
                    </h1>
                    <p className="text-slate-400 font-medium text-sm mt-3 text-center">
                        {isSignUp ? 'Crea tu cuenta de acceso' : 'Bienvenido, ingresa tus credenciales'}
                    </p>
                </div>

                <form onSubmit={handleAuth} className="flex flex-col gap-8">
                    <AnimatePresence mode="wait">
                        {successMessage && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3"
                            >
                                <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={18} />
                                <div>
                                    <h4 className="text-emerald-400 font-bold text-sm">Registro Exitoso</h4>
                                    <p className="text-emerald-400/80 text-xs mt-1">{successMessage}</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="flex flex-col gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Corporativo</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="ejemplo@puntourbano.cl"
                                className="w-full bg-slate-800 text-white rounded-xl py-4 px-4 outline-none border-none focus:ring-1 focus:ring-blue-500 transition-all font-medium placeholder:text-slate-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Contraseña</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-slate-800 text-white rounded-xl py-4 px-4 outline-none border-none focus:ring-1 focus:ring-blue-500 transition-all font-medium placeholder:text-slate-500"
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="bg-red-500/10 border-l-4 border-red-500 p-4 flex items-center gap-3"
                            >
                                <AlertCircle className="text-red-500 shrink-0" size={20} />
                                <p className="text-red-400 text-sm font-medium">{error}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-white hover:bg-slate-200 text-slate-900 font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all transform active:scale-[0.99] flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed text-sm uppercase tracking-wide"
                    >
                        {loading ? (
                            <Loader2 size={20} className="animate-spin" />
                        ) : (
                            <>
                                <span>{isSignUp ? 'Crear mi cuenta' : 'Ingresar al Portal'}</span>
                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <button
                        onClick={() => { setIsSignUp(!isSignUp); setError(null); setSuccessMessage(null); }}
                        className="text-slate-400 text-xs font-bold hover:text-white transition-colors uppercase tracking-widest"
                    >
                        {isSignUp ? 'Volver a Iniciar Sesión' : '¿No tienes cuenta? Regístrate aquí'}
                    </button>
                </div>
            </motion.div>


        </div>
    );
};

export default Login;
