import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { supabase } from '@/api/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Calendar,
    LayoutGrid,
    List,
    Plus,
    CheckCircle2,
    Circle,
    Clock,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Trash2,
    CalendarDays,
    User,
    ArrowRight,
    Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const TaskColumns = [
    { id: 'todo', label: 'A Fazer', color: 'bg-gray-200' },
    { id: 'doing', label: 'Em Andamento', color: 'bg-blue-100 text-blue-700' },
    { id: 'done', label: 'Concluído', color: 'bg-green-100 text-green-700' }
];

export default function Tasks() {
    const { user } = useAuth();
    const [view, setView] = useState('kanban');
    const [tasks, setTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isAddingTask, setIsAddingTask] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [newTask, setNewTask] = useState({
        title: '',
        desc: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        priority: 'Média',
        status: 'todo',
        customer_id: null,
        customer_name: ''
    });

    const columnsRef = useRef({});

    useEffect(() => {
        fetchTasks();
        fetchCustomers();
    }, [user]);

    const fetchTasks = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('agenda')
                .select('*')
                .eq('user_id', user.id);

            if (error) throw error;

            const formattedTasks = data.map(t => {
                let status = t.status || t.category;
                if (!['todo', 'doing', 'done'].includes(status)) {
                    status = t.done ? 'done' : 'todo';
                }

                let customer_name = t.customer_name || '';
                if (!customer_name && t.desc?.includes('👤 Cliente: ')) {
                    customer_name = t.desc.split('👤 Cliente: ')[1]?.split('\n')[0];
                }

                return {
                    ...t,
                    status,
                    customer_name
                };
            });
            setTasks(formattedTasks);
        } catch (err) {
            console.error('Error fetching tasks:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCustomers = async () => {
        try {
            const { data, error } = await supabase.from('customers').select('id, name').order('name');
            if (error) throw error;
            setCustomers(data || []);
        } catch (err) {
            console.error('Error fetching customers:', err);
        }
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        if (!newTask.title.trim()) return;

        const description = newTask.customer_name
            ? `${newTask.desc}\n\n👤 Cliente: ${newTask.customer_name}`
            : newTask.desc;

        const payload = {
            user_id: user?.id,
            title: newTask.title,
            desc: description,
            date: newTask.date,
            priority: newTask.priority,
            category: newTask.status,
            done: newTask.status === 'done',
            customer_id: newTask.customer_id,
            customer_name: newTask.customer_name,
            status: newTask.status
        };

        try {
            const { data, error } = await supabase.from('agenda').insert(payload).select();

            if (error) {
                const basicPayload = {
                    user_id: user?.id,
                    title: newTask.title,
                    desc: description,
                    date: newTask.date,
                    priority: newTask.priority,
                    category: newTask.status,
                    done: newTask.status === 'done'
                };
                const { data: dataBasic, error: errorBasic } = await supabase.from('agenda').insert(basicPayload).select();
                if (errorBasic) throw errorBasic;

                if (dataBasic) {
                    setTasks([...tasks, { ...dataBasic[0], status: newTask.status, customer_name: newTask.customer_name }]);
                }
            } else if (data) {
                setTasks([...tasks, { ...data[0], status: newTask.status, customer_name: newTask.customer_name }]);
            }

            setIsAddingTask(false);
            setNewTask({
                title: '', desc: '', date: format(new Date(), 'yyyy-MM-dd'), priority: 'Média',
                status: 'todo', customer_id: null, customer_name: ''
            });
            setCustomerSearch('');
            toast.success('Tarefa criada!');
        } catch (err) {
            console.error('Error creating task:', err);
            toast.error('Erro ao criar tarefa.');
        }
    };

    const updateTaskStatus = async (taskId, newStatus) => {
        try {
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, done: newStatus === 'done' } : t));

            const payload = {
                category: newStatus,
                status: newStatus,
                done: newStatus === 'done',
                done_at: newStatus === 'done' ? new Date().toISOString() : null
            };

            const { error } = await supabase.from('agenda').update(payload).eq('id', taskId);

            if (error) {
                await supabase.from('agenda').update({
                    category: newStatus,
                    done: newStatus === 'done',
                    done_at: newStatus === 'done' ? new Date().toISOString() : null
                }).eq('id', taskId);
            }
        } catch (err) {
            console.error('Error updating task status:', err);
        }
    };

    const deleteTask = async (taskId) => {
        try {
            setTasks(tasks.filter(t => t.id !== taskId));
            await supabase.from('agenda').delete().eq('id', taskId);
            toast.success('Excluída.');
        } catch (err) {
            console.error('Error deleting task:', err);
        }
    };

    const handleDragEnd = (event, info, taskId) => {
        const x = info.point.x;
        let targetStatus = null;

        for (const [status, ref] of Object.entries(columnsRef.current)) {
            if (ref) {
                const rect = ref.getBoundingClientRect();
                if (x >= rect.left && x <= rect.right) {
                    targetStatus = status;
                    break;
                }
            }
        }

        if (targetStatus) {
            const task = tasks.find(t => t.id === taskId);
            if (task && task.status !== targetStatus) {
                updateTaskStatus(taskId, targetStatus);
            }
        }
    };

    const filteredCustomers = customers.filter(c =>
        c.name?.toLowerCase().includes(customerSearch.toLowerCase())
    ).slice(0, 10);

    const renderKanban = () => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full select-none">
            {TaskColumns.map(column => (
                <div
                    key={column.id}
                    ref={el => columnsRef.current[column.id] = el}
                    className="flex flex-col bg-gray-50/50 rounded-xl border border-gray-100/80 p-3"
                >
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className="font-semibold text-gray-700 flex items-center gap-2 text-sm">
                            <div className={`w-2 h-2 rounded-full ${column.id === 'todo' ? 'bg-gray-400' : column.id === 'doing' ? 'bg-blue-500' : 'bg-green-500'}`} />
                            {column.label}
                        </h3>
                        <span className="text-[10px] font-medium bg-white border border-gray-100 text-gray-400 px-2 py-0.5 rounded-full shadow-sm">
                            {tasks.filter(t => t.status === column.id).length}
                        </span>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto pr-1 overflow-x-hidden custom-scrollbar min-h-[300px]">
                        <AnimatePresence mode="popLayout">
                            {tasks.filter(t => t.status === column.id).map(task => (
                                <motion.div
                                    key={task.id}
                                    layout
                                    drag
                                    dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                                    dragElastic={0.2}
                                    onDragEnd={(e, info) => handleDragEnd(e, info, task.id)}
                                    whileDrag={{
                                        scale: 1.02,
                                        zIndex: 50,
                                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
                                    }}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
                                    className="bg-white p-3.5 rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-gray-100 hover:border-gray-200 transition-all group cursor-grab active:cursor-grabbing relative select-none"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex flex-wrap gap-1.5 align-middle">
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide border ${task.priority === 'Alta' ? 'bg-red-50 text-red-600 border-red-100' :
                                                task.priority === 'Baixa' ? 'bg-gray-50 text-gray-500 border-gray-100' :
                                                    'bg-blue-50 text-blue-600 border-blue-100'
                                                }`}>
                                                {task.priority || 'Média'}
                                            </span>
                                            {task.customer_name && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center gap-1 font-medium">
                                                    <User className="w-2.5 h-2.5" />
                                                    {task.customer_name}
                                                </span>
                                            )}
                                        </div>
                                        <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    <h4 className="font-semibold text-gray-800 text-sm leading-tight mb-1">{task.title}</h4>
                                    {task.desc && <p className="text-[11px] text-gray-500 line-clamp-2 mb-3 leading-relaxed">{task.desc.replace(/👤 Cliente: .*/, '').trim()}</p>}

                                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
                                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400">
                                            <Clock className="w-3 h-3" />
                                            {task.date ? format(new Date(task.date + 'T00:00:00'), 'dd MMM', { locale: ptBR }) : 'S/D'}
                                        </div>

                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {column.id !== 'todo' && (
                                                <button onClick={() => updateTaskStatus(task.id, 'todo')} className="p-1 px-1.5 rounded bg-gray-50 hover:bg-gray-100 text-[9px] text-gray-600 font-medium transition-colors">A Fazer</button>
                                            )}
                                            {column.id !== 'doing' && (
                                                <button onClick={() => updateTaskStatus(task.id, 'doing')} className="p-1 px-1.5 rounded bg-blue-50 hover:bg-blue-100 text-[9px] text-blue-600 font-medium transition-colors">Andamento</button>
                                            )}
                                            {column.id !== 'done' && (
                                                <button onClick={() => updateTaskStatus(task.id, 'done')} className="p-1 px-1.5 rounded bg-green-50 hover:bg-green-100 text-[9px] text-green-600 font-medium transition-colors">Concluir</button>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        <button
                            onClick={() => {
                                setNewTask({ ...newTask, status: column.id });
                                setIsAddingTask(true);
                            }}
                            className="w-full py-3 rounded-xl border border-dashed border-gray-200 text-gray-400 hover:border-gray-300 hover:bg-gray-50/50 transition-all flex items-center justify-center gap-1.5 group/add mt-1"
                        >
                            <Plus className="w-4 h-4 text-gray-400 group-hover/add:text-gray-600 transition-colors" />
                            <span className="text-[11px] font-medium text-gray-500 group-hover/add:text-gray-700">Adicionar</span>
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );

    const renderCalendar = () => {
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);
        const days = eachDayOfInterval({ start: startOfWeek(start), end: addDays(startOfWeek(end), 6) });

        return (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                        <div key={day} className="py-3 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{day}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {days.map((day, idx) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const dayTasks = tasks.filter(t => t.date === dateStr);
                        const isCurrMonth = day.getMonth() === currentDate.getMonth();

                        return (
                            <div
                                key={idx}
                                className={`min-h-[120px] p-2 border-r border-b border-gray-50 transition-all ${!isCurrMonth ? 'bg-gray-50/50' : 'hover:bg-gray-50/30'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[11px] font-medium w-6 h-6 flex items-center justify-center rounded-md transition-all ${isToday(day) ? 'bg-blue-600 text-white' :
                                        isCurrMonth ? 'text-gray-700' : 'text-gray-300'
                                        }`}>
                                        {day.getDate()}
                                    </span>
                                    {isCurrMonth && (
                                        <button
                                            onClick={() => {
                                                setNewTask({ ...newTask, date: dateStr });
                                                setIsAddingTask(true);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar pr-1">
                                    {dayTasks.map(task => (
                                        <div
                                            key={task.id}
                                            className={`text-[10px] px-1.5 py-1 rounded border flex items-center gap-1.5 truncate ${task.status === 'done' ? 'bg-gray-50 border-gray-200 text-gray-400 line-through' :
                                                task.priority === 'Alta' ? 'bg-red-50 border-red-100 text-red-600' :
                                                    'bg-blue-50 border-blue-100 text-blue-600'
                                                }`}
                                        >
                                            <div className={`w-1 h-1 rounded-full shrink-0 ${task.status === 'done' ? 'bg-gray-300' : 'bg-current'}`} />
                                            {task.title}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-[1400px] mx-auto px-6 py-8">
            <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                        <LayoutGrid className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Tarefas</h1>
                        <p className="text-sm text-gray-500">Gerencie suas atividades e prazos.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 w-full sm:w-auto">
                        <button
                            onClick={() => setView('kanban')}
                            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-[11px] font-semibold transition-all ${view === 'kanban' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Quadro
                        </button>
                        <button
                            onClick={() => setView('calendar')}
                            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-[11px] font-semibold transition-all ${view === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Agenda
                        </button>
                        <button
                            onClick={() => setView('list')}
                            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-[11px] font-semibold transition-all ${view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Lista
                        </button>
                    </div>

                    <Button
                        onClick={() => setIsAddingTask(true)}
                        className="rounded-lg bg-gray-900 hover:bg-gray-800 text-white font-medium h-9 px-4 text-xs transition-colors shadow-sm whitespace-nowrap"
                    >
                        <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova Tarefa
                    </Button>
                </div>
            </header>

            {view === 'calendar' && (
                <div className="flex items-center gap-3 mb-6">
                    <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="h-8 w-8 rounded-lg">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-semibold text-gray-900 min-w-[120px] text-center capitalize">
                        {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                    <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="h-8 w-8 rounded-lg">
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            )}

            <main className="min-h-[500px]">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                        <p className="text-gray-400 text-xs font-medium">Carregando...</p>
                    </div>
                ) : (
                    <>
                        {view === 'kanban' && renderKanban()}
                        {view === 'calendar' && renderCalendar()}
                        {view === 'list' && (
                            <div className="space-y-2 max-w-4xl mx-auto">
                                {tasks.sort((a, b) => new Date(b.date) - new Date(a.date)).map(task => (
                                    <div key={task.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4 hover:border-blue-300 transition-colors group">
                                        <button
                                            onClick={() => updateTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')}
                                            className={`transition-all flex-shrink-0 ${task.status === 'done' ? 'text-green-500' : 'text-gray-300 hover:text-blue-500'}`}
                                        >
                                            {task.status === 'done' ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                        </button>

                                        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                                            <div className="sm:col-span-2">
                                                <h4 className={`font-medium text-sm truncate ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.title}</h4>
                                                {task.customer_name && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <User className="w-3 h-3 text-gray-400" />
                                                        <span className="text-xs text-gray-500 truncate">{task.customer_name}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                <span className="text-xs text-gray-600 capitalize">
                                                    {task.date ? format(new Date(task.date + 'T00:00:00'), 'dd MMM', { locale: ptBR }) : '-'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${task.priority === 'Alta' ? 'bg-red-50 text-red-600 border-red-100' :
                                                    task.priority === 'Baixa' ? 'bg-gray-50 text-gray-500 border-gray-100' :
                                                        'bg-blue-50 text-blue-600 border-blue-100'
                                                    }`}>
                                                    {task.priority}
                                                </span>
                                            </div>
                                        </div>

                                        <button onClick={() => deleteTask(task.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* New Task Dialog (Clean & Standard) */}
            <AnimatePresence>
                {isAddingTask && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200"
                        >
                            <form onSubmit={handleCreateTask} className="flex flex-col max-h-[90vh]">
                                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
                                    <h2 className="text-lg font-semibold text-gray-900">Nova Tarefa</h2>
                                    <Button variant="ghost" size="icon" onClick={() => setIsAddingTask(false)} className="h-8 w-8 rounded-full text-gray-400 hover:text-gray-600">
                                        <AlertCircle className="w-5 h-5 rotate-45" />
                                    </Button>
                                </div>

                                <div className="p-6 space-y-5 overflow-y-auto">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-gray-500">O que precisa ser feito?</Label>
                                        <Input
                                            autoFocus
                                            value={newTask.title}
                                            onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                                            placeholder="Ex: Ligar para cliente..."
                                            className="h-10 text-sm"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-gray-500">Cliente (Opcional)</Label>
                                        <div className="relative group">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <Input
                                                placeholder="Buscar cliente..."
                                                className="h-10 pl-9 text-sm"
                                                value={customerSearch}
                                                onChange={e => setCustomerSearch(e.target.value)}
                                            />
                                            {customerSearch.length > 0 && (
                                                <div className="absolute top-11 left-0 right-0 bg-white rounded-lg border border-gray-200 shadow-lg z-50 max-h-[160px] overflow-y-auto p-1">
                                                    {filteredCustomers.map(c => (
                                                        <button
                                                            key={c.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setNewTask({ ...newTask, customer_id: c.id, customer_name: c.name });
                                                                setCustomerSearch('');
                                                            }}
                                                            className="w-full text-left p-2 hover:bg-gray-50 rounded-md transition-colors flex items-center justify-between text-sm"
                                                        >
                                                            <span className="text-gray-700 font-medium">{c.name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {newTask.customer_name && (
                                            <div className="flex items-center gap-2 mt-2 bg-blue-50 border border-blue-100 p-2 rounded-md w-fit">
                                                <User className="w-3.5 h-3.5 text-blue-600" />
                                                <span className="text-xs font-medium text-blue-700">{newTask.customer_name}</span>
                                                <button type="button" onClick={() => setNewTask({ ...newTask, customer_id: null, customer_name: '' })} className="ml-2 text-blue-400 hover:text-red-500">
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium text-gray-500">Data</Label>
                                            <Input
                                                type="date"
                                                value={newTask.date}
                                                onChange={e => setNewTask({ ...newTask, date: e.target.value })}
                                                className="h-10 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium text-gray-500">Prioridade</Label>
                                            <select
                                                value={newTask.priority}
                                                onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                                                className="w-full h-10 px-3 rounded-md border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-black focus:ring-offset-2 outline-none"
                                            >
                                                <option value="Baixa">Baixa</option>
                                                <option value="Média">Média</option>
                                                <option value="Alta">Alta</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-gray-500">Descrição</Label>
                                        <textarea
                                            value={newTask.desc}
                                            onChange={e => setNewTask({ ...newTask, desc: e.target.value })}
                                            className="w-full min-h-[100px] p-3 rounded-md border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 resize-none"
                                            placeholder="Detalhes adicionais..."
                                        />
                                    </div>
                                </div>

                                <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsAddingTask(false)}
                                        className="flex-1 bg-white"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                                    >
                                        Criar Tarefa
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
