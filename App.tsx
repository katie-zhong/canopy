
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { marked } from 'marked';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { VisualCard, VisualCardStatus, Chat, QuizQuestion, LearningStep, QuestionType, Quiz, Roadmap, Folder, UploadedFile, GeneratedVisual, Toast, TranscriptSegment } from './types';
import * as geminiService from './services/geminiService';
import {
    UploadIcon, ShareIcon, MicIcon, PauseIcon, PlayIcon, StopIcon, SparkleIcon, DeleteIcon,
    LinkIcon, NewChatIcon, SearchIcon, NewFolderIcon, StickyNoteIcon,
    SettingsIcon, FlameIcon, QuizIcon, RoadmapIcon, GridIcon, PenIcon, HighlighterIcon, EraserIcon,
    ChevronDownIcon, ChevronRightIcon, SelectIcon, TextIcon, UndoIcon, RedoIcon,
    RectangleIcon, EllipseIcon, LineIcon, ArrowIcon, FileIcon, SidebarCollapseIcon, SourceIcon, PaletteIcon,
    CanopyLogo, ZoomInIcon, ZoomOutIcon, FullScreenIcon, ClearIcon,
    NoteIcon, RefreshIcon, ImageIcon, CheckCircleIcon, XCircleIcon, InfoCircleIcon,
    AiLassoIcon, LightbulbIcon, BookOpenIcon, ConnectIcon, BrainIcon, CritiqueIcon, EyeIcon, EyeSlashIcon, MagicWandIcon
} from './components/Icons';

// Extend the Window interface for external libraries
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
        renderMathInElement: (element: HTMLElement, options: any) => void;
        pdfjsLib: any;
        mammoth: any;
        jspdf: { jsPDF: typeof jsPDF }
        html2canvas: typeof html2canvas
    }
}
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const KatexRenderer: React.FC<{ content: string, className?: string }> = ({ content, className }) => {
    const renderRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (renderRef.current) {
            renderRef.current.innerHTML = content;
            try {
                window.renderMathInElement(renderRef.current, {
                    delimiters: [ {left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}, {left: '\\(', right: '\\)', display: false}, {left: '\\[', right: '\\]', display: true} ], throwOnError: false
                });
            } catch (error) { console.warn("KaTeX rendering error:", error); }
        }
    }, [content]);
    return <div ref={renderRef} className={className}></div>;
};

// Markdown Renderer that handles Math via Katex
const MarkdownRenderer: React.FC<{ content: string, className?: string }> = ({ content, className }) => {
    const [parsedHtml, setParsedHtml] = useState('');
    useEffect(() => {
        const rawHtml = marked.parse(content || '') as string;
        setParsedHtml(rawHtml);
    }, [content]);
    return <KatexRenderer content={parsedHtml} className={className} />;
};

const VisualCardComponent: React.FC<{ card: VisualCard, scale: number, isSelected: boolean, onSelect: (id: string, multi: boolean, clickPos?: {x:number, y:number}) => void, onDelete: (id: string) => void, onUpdate: (card: VisualCard) => void, onRegenerate: (id: string, keyword: string) => void }> = ({ card, scale, isSelected, onSelect, onDelete, onUpdate, onRegenerate }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(card.text || '');
    const dragStartPos = useRef({ x: 0, y: 0, top: 0, left: 0 });
    const cardRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { newlyCreated } = card;
    useEffect(() => {
        if (newlyCreated) {
            setIsEditing(true);
            onUpdate({ ...card, newlyCreated: false });
        }
    }, [newlyCreated, card, onUpdate]);


    useEffect(() => { if (isEditing) { textareaRef.current?.focus(); textareaRef.current?.select(); } }, [isEditing]);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target instanceof HTMLButtonElement || e.target instanceof SVGElement || e.target instanceof Path2D || (e.target as HTMLElement).closest('button')) return;
        if (isEditing && textareaRef.current?.contains(e.target as Node)) return;
        
        onSelect(card.id, e.shiftKey || e.ctrlKey || e.metaKey, {x: e.clientX, y: e.clientY});

        setIsDragging(true);
        dragStartPos.current = { x: e.clientX, y: e.clientY, top: card.position.top, left: card.position.left };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const dx = (e.clientX - dragStartPos.current.x) / scale;
        const dy = (e.clientY - dragStartPos.current.y) / scale;
        onUpdate({ ...card, position: { top: dragStartPos.current.top + dy, left: dragStartPos.current.left + dx } });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    const handleEditBlur = () => {
        setIsEditing(false);
        onUpdate({ ...card, text: editText });
    };
    
    const toggleVisibility = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUpdate({ ...card, visible: !(card.visible ?? true) });
    };

    const handleColorChange = (color: string) => onUpdate({ ...card, backgroundColor: color });

    const cardStyle: React.CSSProperties = { top: `${card.position.top}px`, left: `${card.position.left}px`, transform: `rotate(${card.rotation}deg)`, width: card.width ? `${card.width}px` : undefined, height: card.height ? `${card.height}px` : undefined, backgroundColor: card.backgroundColor };
    
    const colors = ['#fef9c3', '#f0fdf4', '#f0f9ff', '#fef2f2', '#faf5ff'];
    const isTextbox = card.type === 'text' && card.backgroundColor === 'transparent';
    const isAiCard = card.type === 'text' && (card.backgroundColor === '#f0fdf4' || card.backgroundColor === '#dcfce7');
    const isVisible = card.visible ?? true;

    const selectionClass = isSelected ? 'ring-2 ring-[#2f7400] ring-offset-2 z-50' : '';
    
    // Hidden overlay style
    const hiddenOverlay = (
        <div className="absolute inset-0 bg-slate-100/50 backdrop-blur-sm flex items-center justify-center rounded-lg z-20">
             <div className="flex flex-col items-center text-slate-400">
                 <EyeSlashIcon />
                 <span className="text-xs font-semibold mt-1">Hidden</span>
             </div>
        </div>
    );

    if (card.type === 'image') {
        return (
            <div 
                ref={cardRef} 
                onMouseDown={handleMouseDown} 
                style={{ ...cardStyle, width: card.width ? card.width : 300 }} 
                className={`visual-card absolute cursor-grab p-0 bg-transparent border-0 shadow-none group ${selectionClass}`}
            >
                <div className="relative">
                    {!isVisible && hiddenOverlay}
                    {card.imageUrl && <img src={card.imageUrl} alt={card.keyword} className={`w-full h-auto object-contain pointer-events-none select-none ${!isVisible ? 'opacity-0' : ''}`} draggable={false} />}
                </div>
                 <div className="absolute top-0 right-0 m-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                     <button onClick={toggleVisibility} className="p-1 bg-white/70 rounded-full hover:bg-slate-100 text-slate-500">
                        {isVisible ? <EyeIcon /> : <EyeSlashIcon />}
                     </button>
                    <button onClick={() => onDelete(card.id)} className="p-1 bg-white/70 rounded-full hover:bg-red-100 text-slate-400 hover:text-red-600">
                        <DeleteIcon />
                    </button>
                 </div>
            </div>
        );
    }

    const cardClasses = isTextbox
        ? `visual-card absolute group ${selectionClass}`
        : `visual-card bg-white p-3 rounded-lg border border-slate-200 shadow-lg w-56 flex flex-col group ${isAiCard ? 'font-sans' : ''} ${selectionClass}`;

    return (
        <div ref={cardRef} onMouseDown={handleMouseDown} style={cardStyle} className={cardClasses}>
            {!isTextbox && (
                <div className="flex items-start justify-between mb-2 pb-2 border-b border-slate-200/70">
                    <span className="font-semibold text-sm text-slate-700 truncate pr-2">{card.keyword}</span>
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={toggleVisibility} className="p-1 hover:bg-slate-200 rounded-full text-slate-400 mr-1">
                            {isVisible ? <EyeIcon /> : <EyeSlashIcon />}
                        </button>
                        {card.type === 'ai' && (
                            <button onClick={() => onRegenerate(card.id, card.keyword)} className="p-1 hover:bg-slate-200 rounded-full text-slate-400" title="Regenerate"><RefreshIcon/></button>
                        )}
                        {card.type === 'text' && (
                            <div className="relative">
                                <button className="p-1 hover:bg-slate-200 rounded-full" onClick={(e) => { e.stopPropagation(); (e.currentTarget.nextElementSibling as HTMLDivElement).classList.toggle('hidden') }}><PaletteIcon /></button>
                                <div className="absolute top-full right-0 mt-1 bg-white border rounded-md shadow-lg p-1 gap-1 hidden z-10 flex">
                                    {colors.map(c => <button key={c} style={{backgroundColor: c}} className="w-5 h-5 rounded-full border border-slate-200" onClick={() => handleColorChange(c)} />)}
                                </div>
                            </div>
                        )}
                        {card.sourceText && (
                            <div className="relative group/source">
                               <button className="p-1 hover:bg-slate-200 rounded-full text-slate-400" onClick={(e) => e.stopPropagation()}><SourceIcon/></button>
                               <div className="absolute top-full right-0 mt-1 bg-slate-800 text-white text-xs p-2 rounded-md shadow-lg w-64 z-10 opacity-0 group-hover/source:opacity-100 pointer-events-none transition-opacity">
                                    <strong>Source:</strong> "{card.sourceText}"
                               </div>
                            </div>
                        )}
                        <button onClick={() => onDelete(card.id)} className="p-1 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded-full"><DeleteIcon /></button>
                    </div>
                </div>
            )}
            <div className={`flex-grow flex items-center justify-center min-h-[40px] overflow-hidden relative ${isTextbox ? 'p-1' : 'min-h-[120px]'}`}>
                {!isVisible && !isTextbox && hiddenOverlay}
                
                {isTextbox && (
                    <div className="absolute top-[-20px] right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                         <button onClick={toggleVisibility} className="p-1 bg-white rounded-full border shadow-sm text-slate-500">
                             {isVisible ? <EyeIcon /> : <EyeSlashIcon />}
                        </button>
                        <button onClick={() => onDelete(card.id)} className="p-1 bg-white rounded-full hover:bg-red-100 text-slate-400 hover:text-red-600 border shadow-sm">
                            <DeleteIcon />
                        </button>
                    </div>
                )}
                
                {/* Content */}
                <div className={`${!isVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'} w-full h-full`}>
                    {card.status === VisualCardStatus.Loading && <div className="loader mx-auto mt-4"></div>}
                    {card.status === VisualCardStatus.Error && <span className="text-red-500 text-sm">Error</span>}
                    {card.status === VisualCardStatus.Loaded && (
                        <>
                            {card.imageUrl && <img src={card.imageUrl} alt={card.keyword} className="max-w-full max-h-full object-contain pointer-events-none" />}
                            {card.type === 'text' && (isEditing ?
                                <textarea ref={textareaRef} value={editText} onChange={(e) => setEditText(e.target.value)} onBlur={handleEditBlur} className={`w-full h-full resize-none bg-transparent focus:outline-none text-slate-600 ${isTextbox ? 'text-lg' : 'text-sm'}`} /> :
                                <div onDoubleClick={() => setIsEditing(true)} className={`prose ${isTextbox ? 'prose-lg' : 'prose-sm'} text-slate-600 w-full h-full cursor-text ${isAiCard ? 'text-sm leading-relaxed' : ''}`}><MarkdownRenderer content={card.text || ''} /></div>
                            )}
                            {card.type === 'file' && (
                                <div className="flex flex-col items-center text-center p-2">
                                    <FileIcon/>
                                    <span className="text-sm mt-2 font-medium text-slate-600 break-all">{card.keyword}</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const FileList: React.FC<{ files: UploadedFile[], activeFileId: string | null, onSelectFile: (id: string) => void }> = ({ files, activeFileId, onSelectFile }) => {
    if (files.length === 0) return <div className="p-4 text-center text-sm text-slate-500">No files uploaded.</div>;
    return (
        <div className="space-y-2 p-2">
            {files.map(file => (
                <button key={file.id} onClick={() => onSelectFile(file.id)} className={`w-full text-left p-2 rounded-md text-sm flex items-center gap-2 ${activeFileId === file.id ? 'bg-green-100 text-green-900' : 'hover:bg-slate-200/70'}`}>
                    <FileIcon />
                    <span className="truncate flex-grow">{file.name}</span>
                </button>
            ))}
        </div>
    );
};

const FolderItem: React.FC<{ folder: Folder, onRename: (id: string, name: string) => void, onDelete: () => void, isCollapsed: boolean, onToggleCollapse: () => void, onDrop: (e: React.DragEvent) => void, onDragEnter: (e: React.DragEvent) => void, isDropTarget: boolean, children: React.ReactNode }> = ({ folder, onRename, onDelete, isCollapsed, onToggleCollapse, onDrop, onDragEnter, isDropTarget, children }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(folder.name);

    const handleRename = () => {
        setIsEditing(false);
        if (name.trim()) onRename(folder.id, name.trim());
        else setName(folder.name);
    };

    return (
        <div 
            className={`rounded-md my-1 transition-colors border border-transparent ${isDropTarget ? 'bg-green-100 border-green-200' : ''}`} 
            onDrop={onDrop} 
            onDragEnter={onDragEnter}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
        >
            <div className="flex items-center p-2 rounded-t-md hover:bg-slate-200/70 group">
                <button onClick={onToggleCollapse} className="p-1 -ml-1 mr-1">{isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}</button>
                {isEditing ? (
                    <input type="text" value={name} onChange={e => setName(e.target.value)} onBlur={handleRename} onKeyDown={e => e.key === 'Enter' && handleRename()} autoFocus className="flex-grow bg-transparent focus:outline-none focus:ring-1 ring-inset ring-[#2f7400] rounded-sm text-sm font-semibold" />
                ) : (
                    <span onDoubleClick={() => setIsEditing(true)} className="flex-grow truncate text-sm font-semibold text-slate-700 cursor-pointer">{folder.name}</span>
                )}
                <button onClick={() => onDelete()} className="ml-2 p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"><DeleteIcon /></button>
            </div>
            {!isCollapsed && <div className="pl-4 border-l-2 border-slate-200 ml-3 min-h-[10px]">{children}</div>}
        </div>
    );
};

const ChatItem: React.FC<{ chat: Chat, isActive: boolean, onSelect: () => void, onDelete: () => void, onDragStart: (e: React.DragEvent, id: string) => void }> = ({ chat, isActive, onSelect, onDelete, onDragStart }) => (
    <div draggable onDragStart={(e) => onDragStart(e, chat.id)} className={`group flex items-center p-2 rounded-md cursor-pointer ${isActive ? 'bg-[#2f7400]/10 text-[#2f7400]' : 'hover:bg-slate-200/70'}`} onClick={onSelect}>
        <span className="flex-grow truncate text-sm font-medium">{chat.title}</span>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="ml-2 p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 rounded-full"><DeleteIcon /></button>
    </div>
);

const Modal: React.FC<{ children: React.ReactNode, onClose: () => void, title: string, icon?: React.ReactNode, widthClass?: string }> = ({ children, onClose, title, icon, widthClass = 'max-w-2xl' }) => (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
        <div className={`bg-white rounded-lg shadow-2xl w-full ${widthClass} flex flex-col m-4 max-h-[90vh]`} onClick={e => e.stopPropagation()}>
            <header className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-bold flex items-center gap-2">{icon}{title}</h2>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><DeleteIcon /></button>
            </header>
            <main className="p-6 overflow-y-auto">{children}</main>
        </div>
    </div>
);

const QuizModal: React.FC<{ quiz: Quiz, onClose: () => void }> = ({ quiz, onClose }) => {
    const [answers, setAnswers] = useState<(string | null)[]>(Array(quiz.questions.length).fill(null));
    const [submitted, setSubmitted] = useState(false);
    const score = submitted ? answers.reduce((acc, ans, i) => acc + (ans === quiz.questions[i].answer ? 1 : 0), 0) : 0;
    
    const handleAnswer = (qIndex: number, answer: string) => { if (submitted) return; const newAnswers = [...answers]; newAnswers[qIndex] = answer; setAnswers(newAnswers); };
    return (
        <Modal onClose={onClose} title={`Quiz - ${new Date(quiz.createdAt).toLocaleDateString()}`} icon={<QuizIcon />} widthClass="max-w-3xl">
            <div className="space-y-6">
                {quiz.questions.map((q, i) => (
                    <div key={i} className={`p-4 rounded-lg border ${submitted ? (answers[i] === q.answer ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200') : 'bg-slate-50 border-slate-200'}`}>
                        <p className="font-semibold mb-2">{i + 1}. {q.question}</p>
                        {q.type === QuestionType.MultipleChoice && q.options?.map(opt => (
                            <button key={opt} onClick={() => handleAnswer(i, opt)} className={`block w-full text-left p-2 my-1 rounded-md border ${answers[i] === opt ? 'bg-[#2f7400]/20 border-[#2f7400]' : 'hover:bg-slate-100'}`}>{opt}</button>
                        ))}
                        {q.type === QuestionType.TrueFalse && ['True', 'False'].map(opt => (
                             <button key={opt} onClick={() => handleAnswer(i, opt)} className={`inline-block p-2 px-4 mr-2 my-1 rounded-md border ${answers[i] === opt ? 'bg-[#2f7400]/20 border-[#2f7400]' : 'hover:bg-slate-100'}`}>{opt}</button>
                        ))}
                        {(q.type === QuestionType.FillInTheBlank || q.type === QuestionType.CorrectTheStatement) && (
                            <>
                                {q.statement && <p className='italic text-slate-500 mb-2'>"{q.statement}"</p>}
                                <input type="text" onChange={e => handleAnswer(i, e.target.value)} className="w-full p-2 border rounded-md text-slate-500 placeholder:text-slate-400" placeholder='Your answer...' />
                            </>
                        )}
                        {submitted && (
                            <div className={`mt-3 p-3 rounded-md text-sm ${answers[i] === q.answer ? 'bg-green-100' : 'bg-red-100'}`}>
                                <p><strong>Correct Answer:</strong> {q.answer}</p>
                                <p className="mt-1"><strong>Explanation:</strong> {q.explanation}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <div className="mt-6 text-center">
                {submitted ? (
                    <div className="text-xl font-bold">You scored {score} / {quiz.questions.length}!</div>
                ) : (
                    <button onClick={() => setSubmitted(true)} className="px-6 py-2 bg-[#2f7400] text-white rounded-lg font-semibold">Submit Quiz</button>
                )}
            </div>
        </Modal>
    );
};

const RoadmapModal: React.FC<{ roadmap: Roadmap, onClose: () => void, onSetStudyGoal: (goal: string) => void }> = ({ roadmap, onClose, onSetStudyGoal }) => (
    <Modal onClose={onClose} title="Personalized Learning Roadmap" icon={<RoadmapIcon />}>
        <div className="mb-6 p-4 bg-slate-50 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">Suggested Study Goal</h3>
            <p className="text-slate-600 mb-3">{roadmap.suggestedGoal}</p>
            <button onClick={() => onSetStudyGoal(roadmap.suggestedGoal)} className="text-sm font-semibold text-[#2f7400] hover:underline">Set as my study goal</button>
        </div>
        <div className="relative pl-6">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-200" style={{left: '12px'}}></div>
            {roadmap.steps.map((step, i) => (
                <div key={step.step} className="mb-6 relative">
                    <div className="absolute -left-6 top-1 w-6 h-6 bg-[#2f7400] text-white rounded-full flex items-center justify-center font-bold text-sm">{step.step}</div>
                    <div className="ml-4">
                        <h4 className="font-bold text-slate-800">{step.concept}</h4>
                        <p className="text-slate-600">{step.description}</p>
                    </div>
                </div>
            ))}
        </div>
    </Modal>
);

const SettingsModal: React.FC<{ 
    streak: number, goal: string, setGoal: (g: string) => void, reminder: string, setReminder: (r: string) => void, onClose: () => void,
    summaryDetail: number, setSummaryDetail: (v: number) => void, notepadGenerationCount: number, setNotepadGenerationCount: (v: number) => void
}> = ({ streak, goal, setGoal, reminder, setReminder, onClose, summaryDetail, setSummaryDetail, notepadGenerationCount, setNotepadGenerationCount }) => (
    <Modal onClose={onClose} title="Settings & Goals" icon={<SettingsIcon />} widthClass="max-w-lg">
        <div className='space-y-6'>
            <div className='flex items-center gap-4 bg-orange-50 p-4 rounded-lg border border-orange-200'>
                <FlameIcon/>
                <div>
                    <h3 className='font-bold text-orange-800'>Study Streak</h3>
                    <p className='text-orange-700'>You're on a {streak}-day streak! Keep it up.</p>
                </div>
            </div>
            <div>
                <label className="block font-semibold mb-2">My Study Goal</label>
                <input type="text" value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g., Understand Quantum Entanglement" className="w-full p-2 border rounded-md" />
            </div>
            <div>
                <label className="block font-semibold mb-2">Daily Reminder</label>
                <input type="time" value={reminder} onChange={e => setReminder(e.target.value)} className="w-full p-2 border rounded-md" />
            </div>
            <div className='border-t pt-6'>
                <h3 className='font-bold text-lg mb-4'>AI Generation Settings</h3>
                 <div className="space-y-4">
                    <div>
                        <label className="font-semibold text-slate-700 flex justify-between items-center mb-1">
                            <span>Visual versus Text Ratio</span>
                        </label>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span>Text</span>
                            <input type="range" min="0" max="100" step="25" value={summaryDetail} onChange={e => setSummaryDetail(Number(e.target.value))} className="w-full" />
                            <span>Visual</span>
                        </div>
                    </div>
                    <div>
                        <label className="font-semibold text-slate-700 flex justify-between items-center mb-1">
                            <span>Number of Auto-Generated Notes</span>
                            <span className="text-slate-500 font-normal">{notepadGenerationCount} note{notepadGenerationCount === 1 ? '' : 's'}</span>
                        </label>
                        <input type="range" min="1" max="10" value={notepadGenerationCount} onChange={e => setNotepadGenerationCount(Number(e.target.value))} className="w-full" />
                    </div>
                </div>
            </div>
        </div>
    </Modal>
);

const ShareModal: React.FC<{ chat: Chat | undefined, whiteboardEl: HTMLDivElement | null, onClose: () => void }> = ({ chat, whiteboardEl, onClose }) => {
    const [isExporting, setIsExporting] = useState(false);
    
    const handleExport = async (format: 'pdf' | 'png') => {
        if (!whiteboardEl || !chat) return;
        setIsExporting(true);
        try {
            const canvas = await window.html2canvas(whiteboardEl, { useCORS: true, allowTaint: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');

            if (format === 'png') {
                const link = document.createElement('a');
                link.download = `${chat.title}.png`;
                link.href = imgData;
                link.click();
            } else {
                const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
                pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                pdf.save(`${chat.title}.pdf`);
            }
        } catch (error) {
            console.error("Export failed", error);
            alert("Sorry, something went wrong with the export.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Modal onClose={onClose} title="Share & Export" icon={<ShareIcon />} widthClass="max-w-md">
            <div className="space-y-4">
                <p>Export your current whiteboard view as a PDF or PNG file.</p>
                <div className="flex gap-4">
                    <button onClick={() => handleExport('pdf')} disabled={isExporting} className="flex-1 px-4 py-2 bg-slate-600 text-white rounded-lg font-semibold disabled:opacity-50">Export as PDF</button>
                    <button onClick={() => handleExport('png')} disabled={isExporting} className="flex-1 px-4 py-2 bg-[#2f7400] text-white rounded-lg font-semibold disabled:opacity-50">Export as PNG</button>
                </div>
                {isExporting && <p className="text-center text-sm text-slate-500">Generating export, please wait...</p>}
            </div>
        </Modal>
    );
};

const FloatingAiMenu: React.FC<{ selectedCards: VisualCard[], onAction: (action: string) => void, position: {top: number, left: number}, hasLasso: boolean }> = ({ selectedCards, onAction, position, hasLasso }) => {
    if (selectedCards.length === 0 && !hasLasso) return null;

    return (
        <div 
            className="absolute z-50 bg-white rounded-lg shadow-xl border border-slate-200 p-1 flex flex-col gap-1 w-48 animate-fadeInRight origin-top-left"
            style={{ top: position.top, left: position.left }}
        >
            <div className="text-xs font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">AI Tools</div>
            
            {hasLasso && (
                <button onClick={() => onAction('convert-text')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 rounded text-sm text-slate-700 text-left font-medium text-purple-700">
                    <MagicWandIcon /> Convert to Text
                </button>
            )}

            {selectedCards.length > 0 && (
                <>
                    <button onClick={() => onAction('example')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 rounded text-sm text-slate-700 text-left">
                        <LightbulbIcon /> Create example
                    </button>
                    <button onClick={() => onAction('quiz')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 rounded text-sm text-slate-700 text-left">
                        <BrainIcon /> Test my knowledge
                    </button>
                    <button onClick={() => onAction('explain')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 rounded text-sm text-slate-700 text-left">
                        <BookOpenIcon /> Explain
                    </button>
                    <button onClick={() => onAction('connect')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 rounded text-sm text-slate-700 text-left">
                        <ConnectIcon /> Draw connections
                    </button>
                    <button onClick={() => onAction('check')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 rounded text-sm text-slate-700 text-left">
                        <CritiqueIcon /> Double check
                    </button>
                </>
            )}
        </div>
    );
};

const WhiteboardToolbar: React.FC<{
    activeTool: string, setActiveTool: (tool: any) => void, drawColor: string, setDrawColor: (c: string) => void,
    strokeWidth: number, setStrokeWidth: (w: number) => void, lineStyle: 'solid' | 'dashed' | 'dotted', setLineStyle: (s: 'solid' | 'dashed' | 'dotted') => void,
    onUndo: () => void, onRedo: () => void, canUndo: boolean, canRedo: boolean, onBackgroundChange: () => void,
    onColorClick: (color: string) => void, onWipe: () => void
}> = ({ activeTool, setActiveTool, drawColor, setDrawColor, strokeWidth, setStrokeWidth, lineStyle, setLineStyle, onUndo, onRedo, canUndo, canRedo, onBackgroundChange, onColorClick, onWipe }) => {
    const ToolButton = ({ tool, icon, title }: { tool: string, icon: React.ReactNode, title: string }) => (
        <button onClick={() => setActiveTool(tool)} className={`p-2 rounded-md ${activeTool === tool ? 'bg-[#2f7400]/20 text-[#2f7400]' : 'hover:bg-slate-200'}`} title={title}>{icon}</button>
    );
    const drawColors = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899', '#060606'];

    return (
        <div className="bg-white rounded-t-lg border border-b-0 border-slate-200 p-2 flex items-center gap-1 z-30 shadow-sm shrink-0">
            <ToolButton tool="select" icon={<SelectIcon />} title="Select & Pan" />
            <ToolButton tool="ai-lasso" icon={<AiLassoIcon />} title="AI Lasso Tool" />
            <ToolButton tool="text" icon={<TextIcon />} title="Add Textbox" />
            <ToolButton tool="notepad" icon={<StickyNoteIcon />} title="Add Sticky Note" />
            <div className="w-px h-6 bg-slate-200 mx-2"></div>
            <ToolButton tool="pen" icon={<PenIcon />} title="Pen" />
            <ToolButton tool="highlighter" icon={<HighlighterIcon />} title="Highlighter" />
            <ToolButton tool="eraser" icon={<EraserIcon />} title="Eraser" />
             <div className="w-px h-6 bg-slate-200 mx-2"></div>
            <ToolButton tool="rectangle" icon={<RectangleIcon/>} title="Rectangle" />
            <ToolButton tool="ellipse" icon={<EllipseIcon/>} title="Ellipse" />
            <ToolButton tool="line" icon={<LineIcon/>} title="Line" />
            <ToolButton tool="arrow" icon={<ArrowIcon/>} title="Arrow" />
            <div className="w-px h-6 bg-slate-200 mx-2"></div>
            <div className="flex items-center gap-1">
                {drawColors.map(c => <button key={c} onClick={() => onColorClick(c)} style={{backgroundColor: c}} className={`w-6 h-6 rounded-full border-2 ${drawColor === c ? 'border-[#2f7400]' : 'border-transparent'}`}></button>)}
            </div>
            <input type="range" min="2" max="20" value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} className="w-24 mx-2" />
            <div className="relative group">
                <button className="p-2 h-10 w-10 flex items-center justify-center rounded-md hover:bg-slate-200" title="Line Style">
                    <svg width="100%" height="100%" viewBox="0 0 24 24">
                        <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" strokeDasharray={lineStyle === 'solid' ? 'none' : lineStyle === 'dashed' ? '6 3' : '2 3'} strokeLinecap="round" />
                    </svg>
                </button>
                <div className="toolbar-dropdown hidden group-hover:block bg-white p-1 rounded-md border shadow-lg">
                    <button onClick={() => setLineStyle('solid')} className="p-2 w-16 block rounded hover:bg-slate-100"><svg width="100%" height="16"><line x1="0" y1="8" x2="100%" y2="8" stroke="currentColor" strokeWidth="2" /></svg></button>
                    <button onClick={() => setLineStyle('dashed')} className="p-2 w-16 block rounded hover:bg-slate-100"><svg width="100%" height="16"><line x1="0" y1="8" x2="100%" y2="8" stroke="currentColor" strokeWidth="2" strokeDasharray="8 4" strokeLinecap="round" /></svg></button>
                    <button onClick={() => setLineStyle('dotted')} className="p-2 w-16 block rounded hover:bg-slate-100"><svg width="100%" height="16"><line x1="0" y1="8" x2="100%" y2="8" stroke="currentColor" strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" /></svg></button>
                </div>
            </div>
            <div className="flex-grow"></div>
            <button onClick={onBackgroundChange} className="p-2 hover:bg-slate-200 rounded-md" title="Change Background"><GridIcon/></button>
            <div className="w-px h-6 bg-slate-200 mx-2"></div>
            <button onClick={onUndo} disabled={!canUndo} className="p-2 hover:bg-slate-200 rounded-md disabled:opacity-40" title="Undo (Ctrl+Z)"><UndoIcon /></button>
            <button onClick={onRedo} disabled={!canRedo} className="p-2 hover:bg-slate-200 rounded-md disabled:opacity-40" title="Redo (Ctrl+Y)"><RedoIcon /></button>
            <button onClick={onWipe} className="p-2 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-md" title="Clear Whiteboard"><ClearIcon/></button>
        </div>
    );
};

const ToastNotification: React.FC<{ toast: Toast, onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
    const [exiting, setExiting] = useState(false);

    const handleDismiss = () => {
        setExiting(true);
        setTimeout(() => onDismiss(toast.id), 300);
    };
    
    useEffect(() => {
        const timer = setTimeout(handleDismiss, 5000);
        return () => clearTimeout(timer);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const icons = {
        info: <InfoCircleIcon />,
        success: <CheckCircleIcon />,
        error: <XCircleIcon />,
    };
    const colors = {
        info: 'text-blue-500',
        success: 'text-green-500',
        error: 'text-red-500',
    }
    const progressColors = {
        info: 'bg-blue-500',
        success: 'bg-green-500',
        error: 'bg-red-500',
    }

    return (
        <div className={`relative bg-white rounded-lg shadow-lg p-4 flex items-start gap-3 border border-slate-200 overflow-hidden ${exiting ? 'animate-fadeOutRight' : 'animate-fadeInRight'}`}>
            <div className={colors[toast.type]}>{icons[toast.type]}</div>
            <div className="flex-grow text-sm text-slate-700 pr-4">{toast.message}</div>
            <button onClick={handleDismiss} className="absolute top-2 right-2 p-1 -m-1 text-slate-400 hover:text-slate-600"><DeleteIcon /></button>
            <div className="absolute bottom-0 left-0 h-1 bg-slate-100 w-full">
                <div className={`h-full ${progressColors[toast.type]} animate-progress`}></div>
            </div>
        </div>
    );
};

const TranscriptSegmentItem: React.FC<{ segment: TranscriptSegment }> = ({ segment }) => (
    <div className="p-3 mb-2 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
        <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-bold text-[#2f7400] bg-[#2f7400]/10 px-2 py-0.5 rounded-full">{segment.timestamp}</span>
            {segment.category && <span className="text-xs font-medium text-slate-500 border border-slate-200 bg-white px-2 py-0.5 rounded-full">{segment.category}</span>}
        </div>
        {segment.summary && (
             <div className="mb-2 text-sm font-semibold text-slate-800 bg-[#2f7400]/5 p-2 rounded border border-[#2f7400]/10 prose prose-sm max-w-none">
                <MarkdownRenderer content={segment.summary} />
            </div>
        )}
        <div className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none">
            <MarkdownRenderer content={segment.text} />
        </div>
    </div>
);


export const App: React.FC = () => {
    // App State
    const [folders, setFolders] = useState<Folder[]>([]);
    const [chats, setChats] = useState<Chat[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [status, setStatus] = useState<React.ReactNode>('Ready');
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [sessionSeconds, setSessionSeconds] = useState(0); // Total session time tracking
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [studyStreak, setStudyStreak] = useState(0);
    const [activeContextTab, setActiveContextTab] = useState<'notes' | 'files' | 'transcription'>('transcription');
    const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
    const [activeFileId, setActiveFileId] = useState<string | null>(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isContextPanelVisible, setIsContextPanelVisible] = useState(true);
    const [contextPanelWidth, setContextPanelWidth] = useState(384);
    const [liveTranscript, setLiveTranscript] = useState('');
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Toolbox State
    const [activeModalContent, setActiveModalContent] = useState<{ type: 'quiz', data: Quiz } | { type: 'roadmap', data: Roadmap } | {type: 'share'} | null>(null);
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
    const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(false);
    const [isAutoGenerating, setIsAutoGenerating] = useState(false);
    const [summaryDetail, setSummaryDetail] = useState(50); // 0 = text, 100 = visual
    const [notepadGenerationCount, setNotepadGenerationCount] = useState(5);
    
    // Whiteboard State
    type DrawingTool = 'pen' | 'highlighter';
    const [activeTool, setActiveTool] = useState<'select' | 'ai-lasso' | 'text' | 'notepad' | DrawingTool | 'eraser' | 'rectangle' | 'ellipse' | 'line' | 'arrow'>('select');
    const [lastDrawingTool, setLastDrawingTool] = useState<DrawingTool>('pen');
    const [drawColor, setDrawColor] = useState('#EF4444'); // red-500
    const [strokeWidth, setStrokeWidth] = useState(3);
    const [lineStyle, setLineStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');
    const [isDrawing, setIsDrawing] = useState(false);
    
    // Selection & Lasso
    const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
    const [lassoPath, setLassoPath] = useState<{x: number, y: number}[]>([]);
    const [selectionBounds, setSelectionBounds] = useState<{minX: number, maxX: number, minY: number, maxY: number} | null>(null);
    const [aiMenuPosition, setAiMenuPosition] = useState<{top: number, left: number} | null>(null);

    // Drag & Drop State
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);

    // Derived State
    const activeChat = chats.find(c => c.id === activeChatId);

    // Refs
    const recognitionRef = useRef<any>(null);
    const finalTranscriptRef = useRef('');
    const timerIntervalRef = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const whiteboardRef = useRef<HTMLDivElement>(null);
    const whiteboardContainerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const panZoomRef = useRef({ scale: 1, panX: 0, panY: 0, isPanning: false, startPanX: 0, startPanY: 0 });
    const drawStartCoords = useRef({x: 0, y: 0});
    const recognitionOnEndCallbackRef = useRef<(() => void) | undefined>(undefined);
    const autoGenerateTimeoutRef = useRef<number | null>(null);
    const isResizingRef = useRef(false);
    const currentSegmentRef = useRef<TranscriptSegment | null>(null);

    // --- Library Configuration & State Persistence ---
    useEffect(() => { if (window.pdfjsLib) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${window.pdfjsLib.version}/pdf.worker.min.js`; } }, []);
    useEffect(() => {
        try {
            const savedState = localStorage.getItem('canopy-app-state-v4');
            if (savedState) {
                const state = JSON.parse(savedState);
                setFolders(state.folders || []);
                setChats((state.chats || []).map((chat: Chat) => ({ 
                    ...chat, 
                    quizzes: chat.quizzes || [], 
                    roadmaps: chat.roadmaps || [], 
                    uploadedFiles: chat.uploadedFiles || [], 
                    generatedVisuals: chat.generatedVisuals || [], 
                    whiteboardBackground: chat.whiteboardBackground || 'plain',
                    transcriptSegments: chat.transcriptSegments || [] 
                })));
                setActiveChatId(state.activeChatId || null);
            } else { handleNewChat(); }
        } catch (error) { console.error("Failed to load state from localStorage", error); }
    }, []); // eslint-disable-line
    
    // Optimized saveState: Omit heavy drawingHistory to avoid QuotaExceededError
    const saveState = useCallback(() => { 
        try { 
            const chatsToSave = chats.map(c => ({
                ...c,
                drawingHistory: [], // Strip heavy undo history
                drawingHistoryIndex: 0 
            }));
            localStorage.setItem('canopy-app-state-v4', JSON.stringify({ chats: chatsToSave, folders, activeChatId })); 
        } catch (error) { 
            console.error("Failed to save state to localStorage", error); 
            addToast("Storage full. Some history may not be saved.", 'error');
        } 
    }, [chats, folders, activeChatId]);

    useEffect(() => { saveState(); }, [saveState]);
    const updateActiveChat = (updater: (chat: Chat) => Chat) => { setChats(prev => prev.map(c => c.id === activeChatId ? updater(c) : c)); };
    
    const addToast = (message: string, type: Toast['type'] = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev.slice(-4), { id, message, type }]);
    };

    // --- AI Feature Handlers ---
    const handleGenerateSummary = async () => {
        if (!activeChat?.contextText) return;
        setStatus(<span><SparkleIcon /> Generating smart summary...</span>);
        try {
            const [summaryPoints, keywords] = await Promise.all([
                geminiService.summarizeText(activeChat.contextText),
                geminiService.extractKeywords(activeChat.contextText)
            ]);

            const validSummaryPoints = summaryPoints.filter(item => item.point && item.source);
            
            const textRatio = (100 - summaryDetail) / 100;
            const visualRatio = summaryDetail / 100;
            const numTextCards = Math.round(validSummaryPoints.length * textRatio);
            const numVisuals = Math.round(keywords.length * visualRatio);
            
            const summariesToCreate = validSummaryPoints.slice(0, numTextCards);
            const visualsToCreate = keywords.slice(0, numVisuals);

            let currentCards = [...activeChat.visualCards];
            const newSummaryCards: VisualCard[] = [];
            for (const item of summariesToCreate) {
                const title = (item.point.match(/^\s*##\s*(.*)/)?.[1] || item.point.substring(0, 30) + '...').trim();
                const newCard: VisualCard = {
                    id: `card-${Date.now()}-${Math.random()}`, type: 'text', keyword: title, text: item.point, sourceText: item.source, status: VisualCardStatus.Loaded,
                    position: findNextLogicalCardPosition(currentCards),
                    rotation: Math.random() * 4 - 2, 
                    backgroundColor: '#f0fdf4' // green-50 for AI cards
                };
                newSummaryCards.push(newCard);
                currentCards.push(newCard);
            }
             if (newSummaryCards.length > 0) {
                updateActiveChat(c => ({ ...c, visualCards: [...c.visualCards, ...newSummaryCards] }));
            }
            
            if (visualsToCreate.length > 0) {
                const newVisuals: GeneratedVisual[] = visualsToCreate.map(keyword => ({
                    id: `visual-${Date.now()}-${keyword.replace(/\s/g, '-')}`, keyword, status: 'loading'
                }));
                updateActiveChat(c => ({ ...c, generatedVisuals: [...(c.generatedVisuals || []), ...newVisuals] }));

                newVisuals.forEach(visual => { 
                    geminiService.generateVisualForKeyword(visual.keyword, activeChat.contextText)
                        .then(imageUrl => updateActiveChat(c => ({ ...c, generatedVisuals: c.generatedVisuals?.map(v => v.id === visual.id ? { ...v, status: 'loaded', imageUrl } : v) })))
                        .catch(err => { console.error(`Failed to generate visual for ${visual.keyword}`, err); updateActiveChat(c => ({ ...c, generatedVisuals: c.generatedVisuals?.map(v => v.id === visual.id ? { ...v, status: 'error' } : v) })); }); 
                });
            }

            setStatus(`Generated ${newSummaryCards.length} text summaries and ${visualsToCreate.length} visuals.`);
        } catch (error) {
            console.error("Failed to generate smart summary", error);
            setStatus("Could not generate summary.");
        }
    };
    const handleGenerateVisuals = async () => { 
        if (!activeChat?.contextText) return; 
        setStatus(<span><SparkleIcon /> Extracting keywords...</span>); 
        try { 
            const keywords = await geminiService.extractKeywords(activeChat.contextText); 
            if (keywords.length === 0) { setStatus("No keywords found to generate visuals."); return; } 
            setStatus(<span><SparkleIcon /> Found {keywords.length} keywords. Generating images...</span>); 
            
            const newVisuals: GeneratedVisual[] = keywords.map(keyword => ({
                id: `visual-${Date.now()}-${keyword.replace(/\s/g, '-')}`,
                keyword,
                status: 'loading'
            }));
            
            updateActiveChat(c => ({ ...c, generatedVisuals: [...(c.generatedVisuals || []), ...newVisuals] }));

            newVisuals.forEach(visual => { 
                geminiService.generateVisualForKeyword(visual.keyword, activeChat.contextText)
                    .then(imageUrl => { 
                        updateActiveChat(c => ({ ...c, generatedVisuals: c.generatedVisuals?.map(v => v.id === visual.id ? { ...v, status: 'loaded', imageUrl } : v) })); 
                    })
                    .catch(err => { 
                        console.error(`Failed to generate visual for ${visual.keyword}`, err); 
                        updateActiveChat(c => ({ ...c, generatedVisuals: c.generatedVisuals?.map(v => v.id === visual.id ? { ...v, status: 'error' } : v) })); 
                    }); 
            }); 
            setStatus("Visual generation process started. Check the sidebar."); 
        } catch (error) { 
            console.error("Failed to extract keywords for visuals", error); 
            setStatus("Could not start visual generation."); 
        } 
    };

    const handleRegenerateVisual = (cardId: string, keyword: string) => {
        if (!activeChat?.contextText) return;
        updateActiveChat(c => ({...c, visualCards: c.visualCards.map(vc => vc.id === cardId ? {...vc, status: VisualCardStatus.Loading } : vc) }));
        geminiService.generateVisualForKeyword(keyword, activeChat.contextText)
            .then(imageUrl => {
                updateActiveChat(c => ({ ...c, visualCards: c.visualCards.map(vc => vc.id === cardId ? { ...vc, status: VisualCardStatus.Loaded, imageUrl } : vc) }));
            })
            .catch(err => {
                console.error(`Failed to regenerate visual for ${keyword}`, err);
                updateActiveChat(c => ({ ...c, visualCards: c.visualCards.map(vc => vc.id === cardId ? { ...vc, status: VisualCardStatus.Error } : vc) }));
            });
    };

    const handleGenerateQuiz = async (openModal = true) => {
        if (!activeChat?.contextText) return;
        setIsGeneratingQuiz(true);
        setStatus(<span><SparkleIcon /> Generating quiz...</span>);
        try {
            const questions = await geminiService.generateQuiz(activeChat.contextText);
            if (questions.length > 0) {
                const newQuiz: Quiz = { id: `quiz-${Date.now()}`, createdAt: new Date().toISOString(), questions };
                updateActiveChat(c => ({...c, quizzes: [...(c.quizzes || []), newQuiz]}));
                if (openModal) {
                    setActiveModalContent({ type: 'quiz', data: newQuiz });
                } else {
                    addToast("Quiz automatically generated.", 'success');
                }
            }
            setStatus("Ready.");
        } catch (error) {
            console.error("Failed to generate quiz", error);
            setStatus("Could not generate quiz.");
             addToast("Could not generate quiz.", 'error');
        } finally {
            setIsGeneratingQuiz(false);
        }
    };
    const handleGenerateRoadmap = async (openModal = true) => {
        if (!activeChat?.contextText) return;
        setIsGeneratingRoadmap(true);
        setStatus(<span><SparkleIcon /> Generating roadmap...</span>);
        try {
            const { steps, suggestedGoal } = await geminiService.generateLearningRoadmap(activeChat.contextText);
            if (steps.length > 0) {
                const newRoadmap: Roadmap = { id: `roadmap-${Date.now()}`, createdAt: new Date().toISOString(), steps, suggestedGoal };
                updateActiveChat(c => ({...c, roadmaps: [...(c.roadmaps || []), newRoadmap]}));
                if (openModal) {
                    setActiveModalContent({ type: 'roadmap', data: newRoadmap });
                } else {
                    addToast("Learning roadmap automatically generated.", 'success');
                }
            }
             setStatus("Ready.");
        } catch (error) {
            console.error("Failed to generate roadmap", error);
            setStatus("Could not generate roadmap.");
            addToast("Could not generate roadmap.", 'error');
        } finally {
            setIsGeneratingRoadmap(false);
        }
    };
    
    // --- Context Menu AI Actions ---
    const handleAiMenuAction = async (action: string) => {
        // Special case for handwriting conversion - doesn't need selectedCards, but needs selectionBounds
        if (action === 'convert-text' && selectionBounds) {
             setStatus(<span><span className="status-loader"></span> Recognizing handwriting...</span>);
             try {
                const width = selectionBounds.maxX - selectionBounds.minX;
                const height = selectionBounds.maxY - selectionBounds.minY;
                
                // 1. Capture the selected area
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                const tempCtx = tempCanvas.getContext('2d');
                if (!tempCtx || !canvasRef.current) return;
                
                // Draw clipped area from main canvas to temp canvas
                tempCtx.drawImage(
                    canvasRef.current,
                    selectionBounds.minX, selectionBounds.minY, width, height, // Source rect
                    0, 0, width, height // Dest rect
                );
                
                const imageBase64 = tempCanvas.toDataURL('image/png');
                
                // 2. Call Gemini Service
                const resultText = await geminiService.recognizeHandwriting(imageBase64);
                
                // 3. Create new Text Card
                const newCard: VisualCard = {
                    id: `card-${Date.now()}`,
                    type: 'text',
                    keyword: 'Handwritten Note',
                    text: resultText,
                    status: VisualCardStatus.Loaded,
                    position: { top: selectionBounds.minY, left: selectionBounds.minX },
                    rotation: 0,
                    backgroundColor: 'transparent', // Transparent to look like it replaced the text
                    width: width > 200 ? width : 200,
                    newlyCreated: false
                };
                
                // 4. "Erase" the handwriting from the canvas by clearing that rect
                // Note: This is a destructive clear on the raster canvas. 
                const mainCtx = canvasRef.current.getContext('2d');
                if (mainCtx) {
                    mainCtx.clearRect(selectionBounds.minX - 5, selectionBounds.minY - 5, width + 10, height + 10);
                    // Update history
                     if (activeChat) {
                         const newHistory = activeChat.drawingHistory ? [...activeChat.drawingHistory] : [];
                         const dataUrl = canvasRef.current.toDataURL();
                         if (newHistory.length > 20) newHistory.shift();
                         newHistory.push(dataUrl);
                         updateActiveChat(c => ({
                             ...c,
                             visualCards: [...c.visualCards, newCard],
                             drawingHistory: newHistory,
                             drawingHistoryIndex: newHistory.length - 1
                         }));
                     }
                } else {
                     updateActiveChat(c => ({ ...c, visualCards: [...c.visualCards, newCard] }));
                }

                setStatus("Handwriting converted.");
                addToast("Handwriting converted to text.", 'success');
             } catch (error) {
                 console.error("Handwriting conversion failed", error);
                 setStatus("Conversion failed.");
                 addToast("Failed to convert handwriting.", 'error');
             }
             setAiMenuPosition(null);
             setSelectionBounds(null);
             return;
        }

        if (selectedCardIds.length === 0 || !activeChat) return;

        // Gather text context from selected cards
        const selectedText = activeChat.visualCards
            .filter(card => selectedCardIds.includes(card.id))
            .map(card => card.text || card.keyword)
            .join('\n\n');

        if (!selectedText.trim()) {
            addToast("Selected items have no text content.", 'error');
            return;
        }

        setStatus(<span><SparkleIcon /> AI is thinking...</span>);
        
        try {
            if (action === 'quiz') {
                const questions = await geminiService.generateQuiz(selectedText);
                if (questions.length > 0) {
                     const newQuiz: Quiz = { id: `quiz-${Date.now()}`, createdAt: new Date().toISOString(), questions };
                     updateActiveChat(c => ({...c, quizzes: [...(c.quizzes || []), newQuiz]}));
                     setActiveModalContent({ type: 'quiz', data: newQuiz });
                }
            } else {
                // Actions: example, explain, connect, check
                const resultText = await geminiService.performAiAction(action as any, selectedText);
                
                // Create a new card with the result near the first selected card
                const firstCard = activeChat.visualCards.find(c => c.id === selectedCardIds[0]);
                const newPos = firstCard ? { top: firstCard.position.top, left: firstCard.position.left + (firstCard.width || 300) + 20 } : { top: 100, left: 100 };
                
                const newCard: VisualCard = {
                    id: `card-${Date.now()}`,
                    type: 'text',
                    keyword: `AI: ${action.charAt(0).toUpperCase() + action.slice(1)}`,
                    text: resultText,
                    status: VisualCardStatus.Loaded,
                    position: newPos,
                    rotation: 0,
                    backgroundColor: '#f0fdf4', // Green tint for AI response
                    width: 300,
                    newlyCreated: false
                };
                
                updateActiveChat(c => ({ ...c, visualCards: [...c.visualCards, newCard] }));
            }
            setStatus("Ready.");
        } catch (error) {
            console.error("AI Action Failed", error);
            setStatus("AI action failed.");
            addToast("AI action failed.", 'error');
        } finally {
            // Close menu/selection could optionally happen here, but keeping selection allows user to do another action
        }
    };

    // --- Automatic AI Features ---
    useEffect(() => {
        const titleGenerationTimeout = (activeChat && activeChat.title.startsWith('New Session -') && activeChat.contextText.length > 100) ? window.setTimeout(async () => { setStatus(<span><SparkleIcon/> Generating title...</span>); try { const newTitle = await geminiService.generateTitleForText(activeChat.contextText); if (newTitle) { updateActiveChat(c => ({ ...c, title: newTitle })); setStatus("Session title updated."); } else { setStatus("Ready."); } } catch (error) { console.error("Failed to generate title", error); setStatus("Could not generate title."); } }, 2000) : null;
        
        if (autoGenerateTimeoutRef.current) clearTimeout(autoGenerateTimeoutRef.current);
        if (activeChat && activeChat.contextText.length > 300) {
             autoGenerateTimeoutRef.current = window.setTimeout(async () => {
                if (isAutoGenerating) return;
                setIsAutoGenerating(true);
                setStatus(<span><span className="status-loader"></span> Automatically generating content...</span>);
                try {
                    const hasSummary = activeChat.visualCards.some(vc => vc.sourceText);
                    const hasVisuals = activeChat.generatedVisuals && activeChat.generatedVisuals.length > 0;
                    const hasQuiz = activeChat.quizzes && activeChat.quizzes.length > 0;
                    const hasRoadmap = activeChat.roadmaps && activeChat.roadmaps.length > 0;

                    if (!hasSummary && !hasVisuals) await handleGenerateSummary();
                    if (!hasQuiz) await handleGenerateQuiz(false);
                    if (!hasRoadmap) await handleGenerateRoadmap(false);
                } catch (e) {
                    console.error("Auto generation failed", e);
                } finally {
                    setIsAutoGenerating(false);
                    setStatus("Ready.");
                }
            }, 5000);
        }

        const autoCategorizeTimeout = (activeChat && !activeChat.folderId && activeChat.contextText.length > 300 && folders.length > 0) ? window.setTimeout(async () => { setStatus(<span><SparkleIcon/> Organizing session...</span>); try { const folderId = await geminiService.categorizeSession(activeChat.contextText, folders.map(f => ({ id: f.id, name: f.name }))); if (folderId) { updateActiveChat(c => ({ ...c, folderId })); addToast("Session automatically moved to folder.", 'success'); } else { setStatus("Ready."); } } catch (error) { console.error("Failed to categorize session", error); setStatus("Could not auto-organize session."); } }, 4000) : null;
        
        return () => { if (titleGenerationTimeout) clearTimeout(titleGenerationTimeout); if (autoGenerateTimeoutRef.current) clearTimeout(autoGenerateTimeoutRef.current); if (autoCategorizeTimeout) clearTimeout(autoCategorizeTimeout); }
    }, [activeChat?.contextText, activeChat?.id]); // eslint-disable-line

    // --- Chat & Folder Management ---
    const handleNewChat = () => { 
        const newChat: Chat = { 
            id: `chat-${Date.now()}`, 
            title: `New Session - ${new Date().toLocaleTimeString()}`, 
            date: new Date().toISOString(), 
            contextText: '', 
            visualCards: [], 
            generatedVisuals: [],
            drawingHistory: [],
            drawingHistoryIndex: -1,
            transcriptSegments: []
        };
        setChats(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
        setStatus('Ready');
    };

    const handleDeleteChat = () => {
        if (!activeChatId) return;
        setChats(prev => prev.filter(c => c.id !== activeChatId));
        setActiveChatId(null);
    };

    // --- File Handling ---
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!activeChat) { handleNewChat(); return; }
        const file = event.target.files?.[0];
        if (!file) return;

        setStatus(<span><span className="status-loader"></span> Processing {file.name}...</span>);
        let extractedText = "";
        let newCards: VisualCard[] = [];
        let newUploadedFile: UploadedFile = { id: `file-${Date.now()}`, name: file.name, type: 'other', content: '' };

        try {
            if (file.type === 'application/pdf') {
                newUploadedFile.type = 'pdf';
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let offset = 0;

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(' ');
                    extractedText += `\n--- Page ${i} ---\n${pageText}`;

                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const context = canvas.getContext('2d');
                    await page.render({ canvasContext: context, viewport: viewport }).promise;
                    
                    newCards.push({
                        id: `pdf-page-${Date.now()}-${i}`,
                        type: 'image',
                        keyword: `Page ${i}`,
                        imageUrl: canvas.toDataURL(),
                        status: VisualCardStatus.Loaded,
                        position: { top: 100 + offset, left: 100 },
                        rotation: 0,
                        width: 600
                    });
                    
                    // Dynamic spacing based on slide height + padding
                    offset += viewport.height + 50;
                }
            } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                newUploadedFile.type = 'docx';
                const arrayBuffer = await file.arrayBuffer();
                const result = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                extractedText = result.value;
            } else if (file.type.startsWith('image/')) {
                 const reader = new FileReader();
                 const dataUrl = await new Promise<string>((resolve) => { reader.onload = (e) => resolve(e.target?.result as string); reader.readAsDataURL(file); });
                 newCards.push({
                    id: `img-${Date.now()}`, type: 'image', keyword: file.name, imageUrl: dataUrl, status: VisualCardStatus.Loaded,
                    position: { top: 100, left: 100 }, rotation: 0, width: 400
                 });
                 newUploadedFile.type = file.type === 'image/jpeg' ? 'jpeg' : 'png';
                 newUploadedFile.url = dataUrl;
            } else if (file.type === 'text/plain') {
                extractedText = await file.text();
                newUploadedFile.type = 'txt';
            }

            newUploadedFile.content = extractedText;
            updateActiveChat(c => ({
                ...c,
                contextText: (c.contextText + "\n" + extractedText).trim(),
                visualCards: [...c.visualCards, ...newCards],
                uploadedFiles: [...(c.uploadedFiles || []), newUploadedFile]
            }));
            setStatus('File processed successfully.');

        } catch (error) {
            console.error("File upload failed", error);
            setStatus('Failed to process file.');
            addToast('Failed to process file', 'error');
        }
    };

    // --- Sidebar Panning Logic ---
    const panToCard = (card: VisualCard) => {
        const viewportWidth = whiteboardContainerRef.current?.clientWidth || window.innerWidth;
        const viewportHeight = whiteboardContainerRef.current?.clientHeight || window.innerHeight;
        const cardWidth = card.width || 300;
        const cardHeight = card.height || 200;

        const newPanX = (viewportWidth / 2) - (card.position.left + cardWidth / 2) * panZoomRef.current.scale;
        const newPanY = (viewportHeight / 2) - (card.position.top + cardHeight / 2) * panZoomRef.current.scale;

        panZoomRef.current.panX = newPanX;
        panZoomRef.current.panY = newPanY;
        
        // Force re-render of transform
        if (whiteboardRef.current) {
            whiteboardRef.current.style.transform = `translate(${newPanX}px, ${newPanY}px) scale(${panZoomRef.current.scale})`;
        }
        // Force update for canvas alignment
        updateActiveChat(c => ({...c}));
    };

    const handleSidebarVisualClick = async (item: GeneratedVisual) => {
        if (!activeChat) return;
        const existingCard = activeChat.visualCards.find(c => c.keyword === item.keyword);
        if (existingCard) {
            panToCard(existingCard);
        } else {
            // Add card to board if not present
            const newCard: VisualCard = {
                id: `card-${Date.now()}`,
                type: 'image',
                keyword: item.keyword,
                imageUrl: item.imageUrl,
                status: VisualCardStatus.Loaded,
                position: findNextLogicalCardPosition(activeChat.visualCards),
                rotation: 0,
                width: 300,
                visible: true
            };
            updateActiveChat(c => ({ ...c, visualCards: [...c.visualCards, newCard] }));
            // Wait for state update then pan
            setTimeout(() => panToCard(newCard), 100);
        }
    };
    
    const toggleVisualCardVisibility = (generatedVisualId: string) => {
        if (!activeChat) return;
        // Find if this visual is on the board
        const visual = activeChat.generatedVisuals?.find(v => v.id === generatedVisualId);
        if (!visual) return;
        
        const cardOnBoard = activeChat.visualCards.find(c => c.keyword === visual.keyword);
        
        if (cardOnBoard) {
            updateActiveChat(c => ({
                ...c,
                visualCards: c.visualCards.map(vc => vc.id === cardOnBoard.id ? { ...vc, visible: !vc.visible } : vc)
            }));
        }
    };

    const findNextLogicalCardPosition = (cards: VisualCard[]) => {
        // Simple heuristic: put new cards in a grid layout to the right
        const spacing = 320;
        const cols = 3;
        const count = cards.length;
        const row = Math.floor(count / cols);
        const col = count % cols;
        return { top: 100 + row * 250, left: 100 + col * spacing };
    };

    // --- Recording & Transcript ---
    const startRecording = () => {
        if (!('SpeechRecognition' in window)) { alert("Speech Recognition not supported in this browser."); return; }
        if (!activeChat) handleNewChat();
        
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let currentSegmentId = `seg-${Date.now()}`;
        
        recognition.onstart = () => { 
            setIsRecording(true); 
            setIsPaused(false); 
            setStatus('Recording...');
            timerIntervalRef.current = window.setInterval(() => setSessionSeconds(s => s + 1), 1000);
        };
        
        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscriptRef.current += event.results[i][0].transcript + ' ';
                    endCurrentRecordingSegment(currentSegmentId, event.results[i][0].transcript);
                    currentSegmentId = `seg-${Date.now()}`; // New segment
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            setLiveTranscript(interimTranscript);
            
            // Update context text periodically
            if (activeChat) {
                updateActiveChat(c => ({ ...c, contextText: finalTranscriptRef.current }));
            }
        };

        recognition.onerror = (event: any) => { console.error("Speech recognition error", event.error); setStatus('Recording error.'); };
        recognition.onend = () => { 
            if (recognitionOnEndCallbackRef.current) { recognitionOnEndCallbackRef.current(); } // Custom restart logic
            else if (isRecording && !isPaused) { recognition.start(); } // Auto-restart
            else { setIsRecording(false); setStatus('Ready'); if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); }
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    const stopRecording = () => {
        if (recognitionRef.current) {
            recognitionOnEndCallbackRef.current = undefined; // Stop loop
            recognitionRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);
        }
    };

    const endCurrentRecordingSegment = async (id: string, text: string) => {
        if (!activeChat || !text.trim()) return;
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Optimistic update
        const newSegment: TranscriptSegment = {
            id,
            timestamp,
            text,
            isFinal: true
        };
        
        updateActiveChat(c => ({
            ...c,
            transcriptSegments: [...(c.transcriptSegments || []), newSegment]
        }));
        
        // AI Processing in background
        Promise.all([
            geminiService.categorizeTranscriptSegment(text),
            geminiService.summarizeTranscriptSegment(text),
            geminiService.formatTranscriptSegment(text)
        ]).then(([category, summary, formattedText]) => {
            updateActiveChat(c => ({
                ...c,
                transcriptSegments: c.transcriptSegments?.map(s => s.id === id ? { ...s, category, summary, text: formattedText } : s)
            }));
        });
    };
    
    // --- Canvas & Interaction Handlers ---
    
    // (Omitted helper functions for brevity: getPointerPos, etc. implemented inline)

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (!['pen', 'highlighter', 'eraser', 'rectangle', 'ellipse', 'line', 'arrow'].includes(activeTool) && activeTool !== 'ai-lasso') return;
        setIsDrawing(true);
        const { clientX, clientY } = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
        const rect = whiteboardContainerRef.current!.getBoundingClientRect();
        const x = (clientX - rect.left - panZoomRef.current.panX) / panZoomRef.current.scale;
        const y = (clientY - rect.top - panZoomRef.current.panY) / panZoomRef.current.scale;
        
        drawStartCoords.current = { x, y };

        if (activeTool === 'ai-lasso') {
            setLassoPath([{x, y}]);
            return;
        }

        const ctx = canvasRef.current!.getContext('2d')!;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.strokeStyle = activeTool === 'eraser' ? '#ffffff' : drawColor;
        ctx.lineWidth = activeTool === 'highlighter' ? strokeWidth * 4 : strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (activeTool === 'highlighter') ctx.globalAlpha = 0.4;
        else ctx.globalAlpha = 1.0;
        
        if (lineStyle !== 'solid' && ['rectangle', 'ellipse', 'line', 'arrow'].includes(activeTool)) {
            // Shapes handle dash in preview
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const { clientX, clientY } = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
        const rect = whiteboardContainerRef.current!.getBoundingClientRect();
        const x = (clientX - rect.left - panZoomRef.current.panX) / panZoomRef.current.scale;
        const y = (clientY - rect.top - panZoomRef.current.panY) / panZoomRef.current.scale;

        if (activeTool === 'ai-lasso') {
            setLassoPath(prev => [...prev, {x, y}]);
            
            // Visual feedback for lasso
            const ctx = previewCanvasRef.current!.getContext('2d')!;
            ctx.clearRect(0, 0, previewCanvasRef.current!.width, previewCanvasRef.current!.height);
            ctx.beginPath();
            ctx.moveTo(lassoPath[0].x, lassoPath[0].y);
            for (let i = 1; i < lassoPath.length; i++) {
                ctx.lineTo(lassoPath[i].x, lassoPath[i].y);
            }
            ctx.lineTo(x, y);
            ctx.strokeStyle = '#FACC15'; // Yellow-400
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            return;
        }

        if (['pen', 'highlighter', 'eraser'].includes(activeTool)) {
            const ctx = canvasRef.current!.getContext('2d')!;
            ctx.lineTo(x, y);
            ctx.stroke();
        } else {
            // Shapes preview
            const pCtx = previewCanvasRef.current!.getContext('2d')!;
            pCtx.clearRect(0, 0, previewCanvasRef.current!.width, previewCanvasRef.current!.height);
            pCtx.beginPath();
            pCtx.strokeStyle = drawColor;
            pCtx.lineWidth = strokeWidth;
            pCtx.setLineDash(lineStyle === 'dashed' ? [10, 5] : lineStyle === 'dotted' ? [2, 5] : []);
            
            const startX = drawStartCoords.current.x;
            const startY = drawStartCoords.current.y;
            
            if (activeTool === 'rectangle') pCtx.strokeRect(startX, startY, x - startX, y - startY);
            else if (activeTool === 'ellipse') {
                pCtx.ellipse(startX + (x - startX) / 2, startY + (y - startY) / 2, Math.abs(x - startX) / 2, Math.abs(y - startY) / 2, 0, 0, 2 * Math.PI);
                pCtx.stroke();
            } else if (activeTool === 'line') {
                pCtx.moveTo(startX, startY);
                pCtx.lineTo(x, y);
                pCtx.stroke();
            } else if (activeTool === 'arrow') {
                const angle = Math.atan2(y - startY, x - startX);
                pCtx.moveTo(startX, startY);
                pCtx.lineTo(x, y);
                pCtx.stroke();
                // Arrowhead
                pCtx.beginPath();
                pCtx.moveTo(x, y);
                pCtx.lineTo(x - 15 * Math.cos(angle - Math.PI / 6), y - 15 * Math.sin(angle - Math.PI / 6));
                pCtx.lineTo(x - 15 * Math.cos(angle + Math.PI / 6), y - 15 * Math.sin(angle + Math.PI / 6));
                pCtx.closePath();
                pCtx.fillStyle = drawColor;
                pCtx.fill();
            }
        }
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        
        if (activeTool === 'ai-lasso') {
            // Calculate bounding box of lasso
            if (lassoPath.length > 2) {
                const minX = Math.min(...lassoPath.map(p => p.x));
                const maxX = Math.max(...lassoPath.map(p => p.x));
                const minY = Math.min(...lassoPath.map(p => p.y));
                const maxY = Math.max(...lassoPath.map(p => p.y));
                
                // Save geometry for handwriting feature
                setSelectionBounds({minX, maxX, minY, maxY});

                // Find cards inside
                const capturedIds = activeChat?.visualCards.filter(c => {
                    const cX = c.position.left + (c.width || 300) / 2;
                    const cY = c.position.top + 100; // approx center
                    return cX >= minX && cX <= maxX && cY >= minY && cY <= maxY;
                }).map(c => c.id) || [];
                
                setSelectedCardIds(capturedIds);
                // Open menu at mouse pos
                const lastPt = lassoPath[lassoPath.length - 1];
                setAiMenuPosition({
                     top: lastPt.y * panZoomRef.current.scale + panZoomRef.current.panY + 60, // approximate screen coords relative to container
                     left: lastPt.x * panZoomRef.current.scale + panZoomRef.current.panX
                });
            }
            setLassoPath([]);
            const pCtx = previewCanvasRef.current!.getContext('2d')!;
            pCtx.clearRect(0, 0, previewCanvasRef.current!.width, previewCanvasRef.current!.height);
            return;
        }

        // Commit preview to main canvas for shapes
        if (['rectangle', 'ellipse', 'line', 'arrow'].includes(activeTool)) {
            const ctx = canvasRef.current!.getContext('2d')!;
            ctx.drawImage(previewCanvasRef.current!, 0, 0);
            const pCtx = previewCanvasRef.current!.getContext('2d')!;
            pCtx.clearRect(0, 0, previewCanvasRef.current!.width, previewCanvasRef.current!.height);
        }
        
        // Save state to history (canvas snapshot)
        if (activeChat) {
             const newHistory = activeChat.drawingHistory ? [...activeChat.drawingHistory] : [];
             const dataUrl = canvasRef.current!.toDataURL();
             // Limit history size to prevent memory issues (though we clear on save)
             if (newHistory.length > 20) newHistory.shift();
             newHistory.push(dataUrl);
             
             updateActiveChat(c => ({
                 ...c,
                 drawingHistory: newHistory,
                 drawingHistoryIndex: newHistory.length - 1
             }));
        }
    };

    const handleUndo = () => {
        if (!activeChat || !activeChat.drawingHistory || activeChat.drawingHistoryIndex === undefined || activeChat.drawingHistoryIndex <= 0) return;
        const newIndex = activeChat.drawingHistoryIndex - 1;
        const img = new Image();
        img.src = activeChat.drawingHistory[newIndex];
        img.onload = () => {
             const ctx = canvasRef.current!.getContext('2d')!;
             ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
             ctx.drawImage(img, 0, 0);
             updateActiveChat(c => ({ ...c, drawingHistoryIndex: newIndex }));
        };
    };
    
    // Key bindings
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); }
            // Redo could be implemented similarly if we tracked future history
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeChat]);


    return (
        <div className="flex h-screen w-full bg-slate-50 text-slate-800 overflow-hidden font-sans">
            {/* --- Left Sidebar (Chat/File List) --- */}
            <div className={`flex flex-col border-r border-slate-200 bg-white transition-all duration-300 relative ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-64'}`}>
                <div className="p-4 border-b border-[#256000] bg-[#2f7400] flex items-center gap-2">
                    <CanopyLogo />
                </div>
                <div className="p-2 border-b border-slate-100 flex gap-2">
                    <button onClick={handleNewChat} className="flex-1 flex items-center justify-center gap-2 bg-[#2f7400] text-white p-2 rounded-md hover:bg-[#256000] text-sm font-semibold shadow-sm transition-all hover:shadow-md"><NewChatIcon /> New Session</button>
                    <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-md"><SettingsIcon /></button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-2 sidebar-scroll">
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2 px-2 pt-2">
                             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Folders</div>
                             <button 
                                onClick={() => setFolders(prev => [...prev, { id: `folder-${Date.now()}`, name: 'New Folder', date: new Date().toISOString() }])} 
                                className="text-slate-400 hover:text-[#2f7400] hover:bg-slate-100 rounded p-1"
                                title="Create folder"
                             >
                                <NewFolderIcon />
                             </button>
                        </div>
                        {folders.map(folder => (
                            <FolderItem 
                                key={folder.id} folder={folder} 
                                onRename={(id, name) => setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f))} 
                                onDelete={() => setFolders(prev => prev.filter(f => f.id !== folder.id))}
                                isCollapsed={collapsedFolders.has(folder.id)}
                                onToggleCollapse={() => { const newSet = new Set(collapsedFolders); if (newSet.has(folder.id)) newSet.delete(folder.id); else newSet.add(folder.id); setCollapsedFolders(newSet); }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation(); 
                                    if (draggedItemId) {
                                        setChats(prev => prev.map(c => c.id === draggedItemId ? { ...c, folderId: folder.id } : c));
                                        setDraggedItemId(null);
                                        setDropTargetId(null);
                                        addToast(`Moved to ${folder.name}`, 'success');
                                    }
                                }}
                                onDragEnter={(e) => { e.preventDefault(); setDropTargetId(folder.id); }}
                                isDropTarget={dropTargetId === folder.id}
                            >
                                {chats.filter(c => c.folderId === folder.id).map(chat => (
                                    <ChatItem key={chat.id} chat={chat} isActive={chat.id === activeChatId} onSelect={() => setActiveChatId(chat.id)} onDelete={() => setChats(prev => prev.filter(c => c.id !== chat.id))} onDragStart={(e, id) => { setDraggedItemId(id); }} />
                                ))}
                                {chats.filter(c => c.folderId === folder.id).length === 0 && <div className="text-xs text-slate-400 p-2">Empty</div>}
                            </FolderItem>
                        ))}
                    </div>
                    
                    <div>
                        {chats.filter(c => !c.folderId).map(chat => (
                            <ChatItem key={chat.id} chat={chat} isActive={chat.id === activeChatId} onSelect={() => setActiveChatId(chat.id)} onDelete={() => setChats(prev => prev.filter(c => c.id !== chat.id))} onDragStart={(e, id) => { setDraggedItemId(id); }} />
                        ))}
                    </div>
                </div>
            </div>

            {/* --- Center Column (Header + Whiteboard) --- */}
            <div className="flex-grow flex flex-col h-full overflow-hidden min-w-0 relative">
                {/* Header */}
                <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 justify-between shrink-0 z-20">
                   <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-1 text-slate-400 hover:text-slate-600"><SidebarCollapseIcon/></button>
                        {activeChat ? (
                           <div className="flex flex-col">
                                <input type="text" value={activeChat.title} onChange={(e) => updateActiveChat(c => ({...c, title: e.target.value}))} className="font-bold text-slate-800 bg-transparent border-none focus:ring-0 p-0 text-sm" />
                                <span className="text-xs text-slate-500">{new Date(activeChat.date).toLocaleDateString()} &bull; {sessionSeconds > 0 ? `${Math.floor(sessionSeconds / 60)}m ${sessionSeconds % 60}s` : '0m'}</span>
                           </div>
                        ) : <div className="font-bold text-slate-400">Canopy</div>}
                   </div>
                   
                   <div className="flex items-center gap-2">
                        {/* Integrated Controls */}
                        <div className="flex items-center bg-slate-100 rounded-md p-1 mr-2">
                             <label className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-white hover:shadow-sm rounded cursor-pointer transition-all">
                                <UploadIcon />
                                Upload to Board
                                <input type="file" onChange={handleFileUpload} className="hidden" accept=".pdf,.docx,.txt,image/*" ref={fileInputRef} />
                            </label>
                            <div className="w-px h-5 bg-slate-300 mx-1"></div>
                            {!isRecording ? (
                                <button onClick={startRecording} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-white hover:shadow-sm rounded transition-all">
                                    <MicIcon className="w-4 h-4" /> Start Live Audio
                                </button>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <span className="animate-pulse text-red-500 text-xs font-bold mr-2">● LIVE</span>
                                    <button onClick={stopRecording} className="p-1 text-slate-700 hover:text-red-600"><StopIcon/></button>
                                </div>
                            )}
                        </div>

                        <div className="text-sm text-slate-500 mr-4 flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                             {status}
                        </div>
                        <button onClick={() => setActiveModalContent({type: 'share'})} className="p-2 text-[#2f7400] hover:bg-[#2f7400]/10 rounded-full"><ShareIcon /></button>
                        <div className="w-px h-5 bg-slate-200 mx-2"></div>
                        <button onClick={() => setIsContextPanelVisible(!isContextPanelVisible)} className="p-1 text-slate-400 hover:text-slate-600" title="Toggle Side Panel">
                            <SidebarCollapseIcon className="transform rotate-180" />
                        </button>
                   </div>
                </header>

                {/* Whiteboard Area */}
                <div className="flex-grow relative bg-slate-100 overflow-hidden cursor-crosshair touch-none min-w-0" 
                        ref={whiteboardContainerRef}
                        onMouseDown={(e) => { 
                            if (activeTool === 'select' && e.button === 0) {
                            panZoomRef.current.isPanning = true;
                            panZoomRef.current.startPanX = e.clientX;
                            panZoomRef.current.startPanY = e.clientY;
                            } else {
                            startDrawing(e);
                            }
                        }}
                        onMouseMove={(e) => {
                            if (panZoomRef.current.isPanning) {
                                const dx = e.clientX - panZoomRef.current.startPanX;
                                const dy = e.clientY - panZoomRef.current.startPanY;
                                panZoomRef.current.panX += dx;
                                panZoomRef.current.panY += dy;
                                panZoomRef.current.startPanX = e.clientX;
                                panZoomRef.current.startPanY = e.clientY;
                                if (whiteboardRef.current) whiteboardRef.current.style.transform = `translate(${panZoomRef.current.panX}px, ${panZoomRef.current.panY}px) scale(${panZoomRef.current.scale})`;
                            } else {
                                draw(e);
                            }
                        }}
                        onMouseUp={() => { panZoomRef.current.isPanning = false; stopDrawing(); }}
                        onWheel={(e) => {
                            if (e.ctrlKey || e.metaKey) {
                            // Zoom
                            e.preventDefault();
                            const zoomSensitivity = 0.001;
                            const newScale = Math.min(Math.max(0.1, panZoomRef.current.scale - e.deltaY * zoomSensitivity), 5);
                            panZoomRef.current.scale = newScale;
                            } else {
                                // Pan with trackpad
                                panZoomRef.current.panX -= e.deltaX;
                                panZoomRef.current.panY -= e.deltaY;
                            }
                            if (whiteboardRef.current) whiteboardRef.current.style.transform = `translate(${panZoomRef.current.panX}px, ${panZoomRef.current.panY}px) scale(${panZoomRef.current.scale})`;
                        }}
                >
                    {/* Whiteboard Canvas */}
                    <div 
                        ref={whiteboardRef} 
                        className={`absolute top-0 left-0 w-[5000px] h-[5000px] origin-top-left ${activeChat?.whiteboardBackground === 'grid' ? 'bg-grid' : activeChat?.whiteboardBackground === 'lined' ? 'bg-lined' : 'bg-white'}`}
                        style={{ transform: `translate(0px, 0px) scale(1)` }}
                    >
                        <canvas ref={canvasRef} width={5000} height={5000} className="absolute top-0 left-0 pointer-events-none z-10" />
                        <canvas ref={previewCanvasRef} width={5000} height={5000} className="absolute top-0 left-0 pointer-events-none z-20" />
                        
                        {activeChat?.visualCards.map(card => (
                            <VisualCardComponent 
                                key={card.id} card={card} scale={panZoomRef.current.scale}
                                isSelected={selectedCardIds.includes(card.id)}
                                onSelect={(id, multi, pos) => {
                                    if (multi) setSelectedCardIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
                                    else setSelectedCardIds([id]);
                                    
                                    if (activeTool === 'select' && pos) {
                                        setAiMenuPosition({ top: pos.y + 20, left: pos.x + 20 });
                                    }
                                }}
                                onDelete={(id) => updateActiveChat(c => ({ ...c, visualCards: c.visualCards.filter(vc => vc.id !== id) }))}
                                onUpdate={(updatedCard) => updateActiveChat(c => ({ ...c, visualCards: c.visualCards.map(vc => vc.id === updatedCard.id ? updatedCard : vc) }))}
                                onRegenerate={handleRegenerateVisual}
                            />
                        ))}
                    </div>

                    {/* Floating Toolbar */}
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2">
                        <WhiteboardToolbar 
                            activeTool={activeTool} setActiveTool={(t) => { setActiveTool(t); if(['pen','highlighter'].includes(t)) setLastDrawingTool(t); }}
                            drawColor={drawColor} setDrawColor={setDrawColor}
                            strokeWidth={strokeWidth} setStrokeWidth={setStrokeWidth}
                            lineStyle={lineStyle} setLineStyle={setLineStyle}
                            onUndo={handleUndo} onRedo={() => {}}
                            canUndo={!!(activeChat?.drawingHistoryIndex && activeChat.drawingHistoryIndex > 0)}
                            canRedo={false}
                            onBackgroundChange={() => updateActiveChat(c => ({...c, whiteboardBackground: c.whiteboardBackground === 'plain' ? 'grid' : c.whiteboardBackground === 'grid' ? 'lined' : 'plain'}))}
                            onColorClick={setDrawColor}
                            onWipe={() => { 
                                const ctx = canvasRef.current!.getContext('2d')!; 
                                ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height); 
                                updateActiveChat(c => ({...c, visualCards: [], drawingHistory: [], drawingHistoryIndex: -1 })); 
                            }}
                        />
                    </div>
                    
                    {/* Context Menu for AI Lasso/Selection */}
                    {aiMenuPosition && (
                        <FloatingAiMenu 
                            selectedCards={activeChat?.visualCards.filter(c => selectedCardIds.includes(c.id)) || []}
                            onAction={handleAiMenuAction}
                            position={aiMenuPosition}
                            hasLasso={!!selectionBounds}
                        />
                    )}
                </div>
            </div>

            {/* --- Right Context Panel (Full Height Sibling) --- */}
            <div 
                className={`bg-white border-l border-slate-200 flex flex-col shadow-xl z-30 transition-all duration-300 ${isContextPanelVisible ? '' : 'w-0 border-none overflow-hidden'}`} 
                style={{ width: isContextPanelVisible ? contextPanelWidth : 0 }}
            >
                {isContextPanelVisible && (
                    <>
                        {/* Resizer handle */}
                        <div 
                            className="absolute left-0 top-0 bottom-0 w-1 bg-transparent hover:bg-[#2f7400] cursor-ew-resize z-40"
                            onMouseDown={(e) => {
                                isResizingRef.current = true;
                                document.addEventListener('mousemove', handleResize);
                                document.addEventListener('mouseup', stopResize);
                            }}
                        ></div>
                        
                        {/* Panel Header/Tabs */}
                        <div className="flex border-b border-slate-200">
                                <button onClick={() => setActiveContextTab('transcription')} className={`flex-1 p-3 text-sm font-semibold border-b-2 ${activeContextTab === 'transcription' ? 'border-[#2f7400] text-[#2f7400]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Live Transcript</button>
                                <button onClick={() => setActiveContextTab('notes')} className={`flex-1 p-3 text-sm font-semibold border-b-2 ${activeContextTab === 'notes' ? 'border-[#2f7400] text-[#2f7400]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>AI Notes</button>
                                <button onClick={() => setActiveContextTab('files')} className={`flex-1 p-3 text-sm font-semibold border-b-2 ${activeContextTab === 'files' ? 'border-[#2f7400] text-[#2f7400]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Visuals & Files</button>
                        </div>

                        {/* Panel Content */}
                        <div className="flex-grow overflow-y-auto p-4 bg-slate-50">
                                {activeContextTab === 'transcription' && (
                                <div className="space-y-4">
                                        {activeChat?.transcriptSegments?.map(segment => (
                                            <TranscriptSegmentItem key={segment.id} segment={segment} />
                                        ))}
                                        {liveTranscript && (
                                            <div className="p-3 bg-white rounded-lg border border-[#2f7400]/30 shadow-sm animate-pulse">
                                                <div className="text-xs font-bold text-[#2f7400] mb-1">Live...</div>
                                                <div className="text-sm text-slate-600 italic">{liveTranscript}</div>
                                            </div>
                                        )}
                                        {(!activeChat?.transcriptSegments || activeChat.transcriptSegments.length === 0) && !isRecording && (
                                            <div className="text-center text-slate-400 mt-10">
                                                <MicIcon className="w-12 h-12 mx-auto mb-2 opacity-20"/>
                                                <p>Start recording to see live captions and AI summaries.</p>
                                            </div>
                                        )}
                                </div>
                                )}

                                {activeContextTab === 'notes' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-bold text-slate-700">Key Concepts</h3>
                                        <button onClick={handleGenerateSummary} className="text-xs text-[#2f7400] font-semibold hover:underline">Regenerate</button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3">
                                        {activeChat?.visualCards.filter(c => c.type === 'text' && c.backgroundColor === '#f0fdf4').map(card => (
                                            <div key={card.id} className="bg-white p-3 rounded border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => panToCard(card)}>
                                                <div className="flex justify-between">
                                                    <h4 className="font-bold text-sm mb-1">{card.keyword}</h4>
                                                    <button onClick={(e) => { e.stopPropagation(); toggleVisualCardVisibility(card.id); }} className="text-slate-400 hover:text-slate-600">
                                                        {card.visible !== false ? <EyeIcon/> : <EyeSlashIcon/>}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-slate-500 line-clamp-3">{card.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => handleGenerateQuiz(true)} className="w-full mt-4 py-2 border border-slate-300 rounded-md hover:bg-white text-sm font-semibold flex items-center justify-center gap-2">
                                        <QuizIcon /> Generate Quiz
                                    </button>
                                    <button onClick={() => handleGenerateRoadmap(true)} className="w-full mt-2 py-2 border border-slate-300 rounded-md hover:bg-white text-sm font-semibold flex items-center justify-center gap-2">
                                        <RoadmapIcon /> Learning Roadmap
                                    </button>
                                </div>
                                )}

                                {activeContextTab === 'files' && (
                                    <div className="space-y-6">
                                    <div>
                                        <h3 className="font-bold text-slate-700 mb-2">Generated Visuals</h3>
                                        <div className="grid grid-cols-2 gap-2">
                                            {activeChat?.generatedVisuals?.map(visual => (
                                                <div key={visual.id} className="relative group aspect-square bg-white rounded border border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => handleSidebarVisualClick(visual)}>
                                                    {visual.status === 'loading' ? <div className="loader w-6 h-6 border-2"></div> : 
                                                        visual.status === 'error' ? <span className="text-xs text-red-500">Error</span> :
                                                        <img src={visual.imageUrl} alt={visual.keyword} className="w-full h-full object-cover" />}
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs text-center p-1">
                                                        {visual.keyword}
                                                        <button 
                                                            className="absolute top-1 right-1 p-1 bg-white/20 rounded-full hover:bg-white/40"
                                                            onClick={(e) => { e.stopPropagation(); toggleVisualCardVisibility(visual.id); }}
                                                        >
                                                                <EyeIcon />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <button onClick={handleGenerateVisuals} className="aspect-square border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-slate-400 hover:border-[#2f7400] hover:text-[#2f7400] transition-colors">
                                                <SparkleIcon />
                                                <span className="text-xs mt-1">Generate</span>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <h3 className="font-bold text-slate-700 mb-2">Uploaded Files</h3>
                                        <FileList files={activeChat?.uploadedFiles || []} activeFileId={activeFileId} onSelectFile={setActiveFileId} />
                                    </div>
                                    </div>
                                )}
                        </div>
                    </>
                )}
            </div>

            {/* --- Modals & Overlays --- */}
            {activeModalContent && activeModalContent.type === 'quiz' && <QuizModal quiz={activeModalContent.data} onClose={() => setActiveModalContent(null)} />}
            {activeModalContent && activeModalContent.type === 'roadmap' && <RoadmapModal roadmap={activeModalContent.data} onClose={() => setActiveModalContent(null)} onSetStudyGoal={(g) => { setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, studyGoal: g } : c)); addToast('Study goal updated!', 'success'); setActiveModalContent(null); }} />}
            {activeModalContent && activeModalContent.type === 'share' && <ShareModal chat={activeChat} whiteboardEl={whiteboardContainerRef.current} onClose={() => setActiveModalContent(null)} />}
            {isSettingsOpen && <SettingsModal streak={studyStreak} goal={activeChat?.studyGoal || ''} setGoal={(g) => updateActiveChat(c => ({...c, studyGoal: g}))} reminder={activeChat?.reminderTime || ''} setReminder={(r) => updateActiveChat(c => ({...c, reminderTime: r}))} onClose={() => setIsSettingsOpen(false)} summaryDetail={summaryDetail} setSummaryDetail={setSummaryDetail} notepadGenerationCount={notepadGenerationCount} setNotepadGenerationCount={setNotepadGenerationCount} />}
            
            {/* Toasts */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
                {toasts.map(toast => <ToastNotification key={toast.id} toast={toast} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />)}
            </div>

        </div>
    );
    
    function handleResize(e: MouseEvent) {
        if (!isResizingRef.current) return;
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth > 250 && newWidth < 800) setContextPanelWidth(newWidth);
    }
    
    function stopResize() {
        isResizingRef.current = false;
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
    }
};
