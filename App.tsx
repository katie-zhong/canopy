import React, { useState, useEffect, useRef, useCallback } from 'react';
import { marked } from 'marked';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { VisualCard, VisualCardStatus, Chat, QuizQuestion, LearningStep, QuestionType, Quiz, Roadmap, Folder, UploadedFile, GeneratedVisual, Toast } from './types';
import * as geminiService from './services/geminiService';
import {
    UploadIcon, ShareIcon, MicIcon, PauseIcon, PlayIcon, StopIcon, SparkleIcon, DeleteIcon,
    LinkIcon, NewChatIcon, SearchIcon, NewFolderIcon, StickyNoteIcon,
    SettingsIcon, FlameIcon, QuizIcon, RoadmapIcon, GridIcon, PenIcon, HighlighterIcon, EraserIcon,
    ChevronDownIcon, ChevronRightIcon, SelectIcon, TextIcon, UndoIcon, RedoIcon,
    RectangleIcon, EllipseIcon, LineIcon, ArrowIcon, FileIcon, SidebarCollapseIcon, SourceIcon, PaletteIcon,
    CanopyLogo, ZoomInIcon, ZoomOutIcon, FullScreenIcon, ClearIcon,
    NoteIcon, RefreshIcon, ImageIcon, CheckCircleIcon, XCircleIcon, InfoCircleIcon
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

const VisualCardComponent: React.FC<{ card: VisualCard, scale: number, onDelete: (id: string) => void, onUpdate: (card: VisualCard) => void, onRegenerate: (id: string, keyword: string) => void }> = ({ card, scale, onDelete, onUpdate, onRegenerate }) => {
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
            // Remove the flag after triggering edit mode
            onUpdate({ ...card, newlyCreated: false });
        }
    }, [newlyCreated, card, onUpdate]);


    useEffect(() => { if (isEditing) { textareaRef.current?.focus(); textareaRef.current?.select(); } }, [isEditing]);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target instanceof HTMLButtonElement || e.target instanceof SVGElement || e.target instanceof Path2D || (e.target as HTMLElement).closest('button')) return;
        if (isEditing && textareaRef.current?.contains(e.target as Node)) return;
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

    const handleColorChange = (color: string) => onUpdate({ ...card, backgroundColor: color });

    const cardStyle: React.CSSProperties = { top: `${card.position.top}px`, left: `${card.position.left}px`, transform: `rotate(${card.rotation}deg)`, width: card.width ? `${card.width}px` : undefined, height: card.height ? `${card.height}px` : undefined, backgroundColor: card.backgroundColor };
    
    const colors = ['#fef9c3', '#f0fdf4', '#f0f9ff', '#fef2f2', '#faf5ff'];
    const isTextbox = card.type === 'text' && card.backgroundColor === 'transparent';

    if (card.type === 'image') {
        return (
            <div 
                ref={cardRef} 
                onMouseDown={handleMouseDown} 
                style={{ ...cardStyle, width: card.width ? card.width : 300 }} // Provide a default width
                className="visual-card absolute cursor-grab p-0 bg-transparent border-0 shadow-none group"
            >
                {card.imageUrl && <img src={card.imageUrl} alt={card.keyword} className="w-full h-auto object-contain pointer-events-none" />}
                <button onClick={() => onDelete(card.id)} className="absolute top-0 right-0 m-1 p-1 bg-white/70 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-100 text-slate-400 hover:text-red-600 transition-opacity z-10">
                    <DeleteIcon />
                </button>
            </div>
        );
    }

    const cardClasses = isTextbox
        ? "visual-card absolute group"
        : "visual-card bg-white p-3 rounded-lg border border-slate-200 shadow-lg w-56 flex flex-col group";

    return (
        <div ref={cardRef} onMouseDown={handleMouseDown} style={cardStyle} className={cardClasses}>
            {!isTextbox && (
                <div className="flex items-start justify-between mb-2 pb-2 border-b border-slate-200/70">
                    <span className="font-semibold text-sm text-slate-700 truncate pr-2">{card.keyword}</span>
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
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
                {isTextbox && (
                     <button onClick={() => onDelete(card.id)} className="absolute top-[-8px] right-[-8px] p-1 bg-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-100 text-slate-400 hover:text-red-600 transition-opacity z-10 border shadow-sm">
                        <DeleteIcon />
                    </button>
                )}
                {card.status === VisualCardStatus.Loading && <div className="loader"></div>}
                {card.status === VisualCardStatus.Error && <span className="text-red-500 text-sm">Error</span>}
                {card.status === VisualCardStatus.Loaded && (
                    <>
                        {card.imageUrl && <img src={card.imageUrl} alt={card.keyword} className="max-w-full max-h-full object-contain" />}
                        {card.type === 'text' && (isEditing ?
                            <textarea ref={textareaRef} value={editText} onChange={(e) => setEditText(e.target.value)} onBlur={handleEditBlur} className={`w-full h-full resize-none bg-transparent focus:outline-none text-slate-600 ${isTextbox ? 'text-lg' : 'text-sm'}`} /> :
                            <div onDoubleClick={() => setIsEditing(true)} className={`prose ${isTextbox ? 'prose-lg' : 'prose-sm'} text-slate-600 w-full h-full cursor-text`}><KatexRenderer content={marked.parse(card.text || '') as string} /></div>
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
        <div className={`rounded-md my-1 transition-colors ${isDropTarget ? 'bg-green-100' : ''}`} onDrop={onDrop} onDragEnter={onDragEnter}>
            <div className="flex items-center p-2 rounded-t-md hover:bg-slate-200/70 group">
                <button onClick={onToggleCollapse} className="p-1 -ml-1 mr-1">{isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}</button>
                {isEditing ? (
                    <input type="text" value={name} onChange={e => setName(e.target.value)} onBlur={handleRename} onKeyDown={e => e.key === 'Enter' && handleRename()} autoFocus className="flex-grow bg-transparent focus:outline-none focus:ring-1 ring-inset ring-[#2f7400] rounded-sm text-sm font-semibold" />
                ) : (
                    <span onDoubleClick={() => setIsEditing(true)} className="flex-grow truncate text-sm font-semibold text-slate-700 cursor-pointer">{folder.name}</span>
                )}
                <button onClick={() => onDelete()} className="ml-2 p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"><DeleteIcon /></button>
            </div>
            {!isCollapsed && <div className="pl-4 border-l-2 border-slate-200 ml-3">{children}</div>}
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

const NewSessionModal: React.FC<{ onClose: () => void, onRecord: () => void, onUpload: () => void }> = ({ onClose, onRecord, onUpload }) => (
    <Modal onClose={onClose} title="Start Your New Session" icon={<CanopyLogo className="!text-xl" />} widthClass="max-w-lg">
        <div className="text-center">
            <p className="text-slate-600 mb-6">How would you like to begin? You can add more content later.</p>
            <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={onRecord} className="flex-1 flex flex-col items-center justify-center gap-3 p-6 bg-[#2f7400] text-white rounded-lg font-semibold hover:bg-[#255b00] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2f7400]">
                    <MicIcon />
                    <span>Record Audio</span>
                </button>
                <button onClick={onUpload} className="flex-1 flex flex-col items-center justify-center gap-3 p-6 bg-[#2f7400] text-white rounded-lg font-semibold hover:bg-[#255b00] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2f7400]">
                    <UploadIcon />
                    <span>Upload Files</span>
                </button>
            </div>
        </div>
    </Modal>
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
                    <h4 className="font-bold text-slate-800">{step.concept}</h4>
                    <p className="text-slate-600">{step.description}</p>
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

const WhiteboardToolbar: React.FC<{
    activeTool: string, setActiveTool: (tool: any) => void, drawColor: string, setDrawColor: (c: string) => void,
    strokeWidth: number, setStrokeWidth: (w: number) => void, lineStyle: 'solid' | 'dashed' | 'dotted', setLineStyle: (s: 'solid' | 'dashed' | 'dotted') => void,
    onUndo: () => void, onRedo: () => void, canUndo: boolean, canRedo: boolean, onAddFile: () => void, onBackgroundChange: () => void,
    onColorClick: (color: string) => void, onWipe: () => void
}> = ({ activeTool, setActiveTool, drawColor, setDrawColor, strokeWidth, setStrokeWidth, lineStyle, setLineStyle, onUndo, onRedo, canUndo, canRedo, onAddFile, onBackgroundChange, onColorClick, onWipe }) => {
    const ToolButton = ({ tool, icon, title }: { tool: string, icon: React.ReactNode, title: string }) => (
        <button onClick={() => setActiveTool(tool)} className={`p-2 rounded-md ${activeTool === tool ? 'bg-[#2f7400]/20 text-[#2f7400]' : 'hover:bg-slate-200'}`} title={title}>{icon}</button>
    );
    const drawColors = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899', '#060606'];

    return (
        <div className="bg-white rounded-t-lg border border-b-0 border-slate-200 p-2 flex items-center gap-1 z-30 shadow-sm shrink-0">
            <ToolButton tool="select" icon={<SelectIcon />} title="Select & Pan" />
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
            <button onClick={onAddFile} className="p-2 hover:bg-slate-200 rounded-md" title="Add Image/File to Board"><FileIcon/></button>
            <button onClick={onBackgroundChange} className="p-2 hover:bg-slate-200 rounded-md" title="Change Background"><GridIcon/></button>
            <div className="w-px h-6 bg-slate-200 mx-2"></div>
            <button onClick={onUndo} disabled={!canUndo} className="p-2 hover:bg-slate-200 rounded-md disabled:opacity-40" title="Undo"><UndoIcon /></button>
            <button onClick={onRedo} disabled={!canRedo} className="p-2 hover:bg-slate-200 rounded-md disabled:opacity-40" title="Redo"><RedoIcon /></button>
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

// Fix: Changed to a named export.
export const App: React.FC = () => {
    // App State
    const [folders, setFolders] = useState<Folder[]>([]);
    const [chats, setChats] = useState<Chat[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [status, setStatus] = useState<React.ReactNode>('Select a session or create a new one.');
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [studyStreak, setStudyStreak] = useState(0);
    const [activeContextTab, setActiveContextTab] = useState<'notes' | 'files' | 'transcription'>('notes');
    const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
    const [activeFileId, setActiveFileId] = useState<string | null>(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isContextPanelVisible, setIsContextPanelVisible] = useState(true);
    const [contextPanelWidth, setContextPanelWidth] = useState(384);
    const [liveTranscript, setLiveTranscript] = useState('');
    const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
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
    const [activeTool, setActiveTool] = useState<'select' | 'text' | 'notepad' | DrawingTool | 'eraser' | 'rectangle' | 'ellipse' | 'line' | 'arrow'>('select');
    const [lastDrawingTool, setLastDrawingTool] = useState<DrawingTool>('pen');
    const [drawColor, setDrawColor] = useState('#EF4444'); // red-500
    const [strokeWidth, setStrokeWidth] = useState(3);
    const [lineStyle, setLineStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');
    const [isDrawing, setIsDrawing] = useState(false);
    
    // Drag & Drop State
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);

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

    const activeChat = chats.find(c => c.id === activeChatId);
    const activeFile = activeChat?.uploadedFiles?.find(f => f.id === activeFileId);

    // --- Library Configuration & State Persistence ---
    useEffect(() => { if (window.pdfjsLib) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${window.pdfjsLib.version}/pdf.worker.min.js`; } }, []);
    useEffect(() => {
        try {
            const savedState = localStorage.getItem('canopy-app-state-v3');
            if (savedState) {
                const state = JSON.parse(savedState);
                setFolders(state.folders || []);
                setChats((state.chats || []).map((chat: Chat) => ({ ...chat, quizzes: chat.quizzes || [], roadmaps: chat.roadmaps || [], uploadedFiles: chat.uploadedFiles || [], generatedVisuals: chat.generatedVisuals || [], whiteboardBackground: chat.whiteboardBackground || 'plain' })));
                setActiveChatId(state.activeChatId || null);
            } else { handleNewChat(); }
        } catch (error) { console.error("Failed to load state from localStorage", error); }
    }, []); // eslint-disable-line
    const saveState = useCallback(() => { try { localStorage.setItem('canopy-app-state-v3', JSON.stringify({ chats, folders, activeChatId })); } catch (error) { console.error("Failed to save state to localStorage", error); } }, [chats, folders, activeChatId]);
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
                    rotation: Math.random() * 4 - 2, backgroundColor: '#f0fdf4'
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
    const handleNewChat = () => { const newChat: Chat = { id: `chat-${Date.now()}`, title: `New Session - ${new Date().toLocaleDateString()}`, date: new Date().toISOString(), contextText: '', visualCards: [], summaryPoints: [], quizzes: [], roadmaps: [], generatedVisuals: [], uploadedFiles: [], drawingHistory: [], drawingHistoryIndex: -1, whiteboardBackground: 'plain', folderId: null }; setChats(prev => [newChat, ...prev]); setActiveChatId(newChat.id); setIsNewSessionModalOpen(true); };
    const handleNewFolder = () => { const newFolder: Folder = { id: `folder-${Date.now()}`, name: 'New Course Folder', date: new Date().toISOString() }; setFolders(prev => [newFolder, ...prev]); };
    const handleRenameFolder = (folderId: string, newName: string) => { setFolders(folders => folders.map(f => f.id === folderId ? { ...f, name: newName } : f)); };
    const handleDeleteFolder = (folderId: string) => { setFolders(folders => folders.filter(f => f.id !== folderId)); setChats(chats => chats.map(c => c.folderId === folderId ? { ...c, folderId: null } : c)); };
    const handleDeleteChat = (chatId: string) => { setChats(prev => prev.filter(c => c.id !== chatId)); if (activeChatId === chatId) setActiveChatId(null); };
    const toggleFolderCollapse = (folderId: string) => { setCollapsedFolders(prev => { const newSet = new Set(prev); if (newSet.has(folderId)) newSet.delete(folderId); else newSet.add(folderId); return newSet; }); };
    
    // --- Drag & Drop Handlers ---
    const handleDragStart = (e: React.DragEvent, chatId: string) => { setDraggedItemId(chatId); e.dataTransfer.effectAllowed = 'move'; };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
    const handleDrop = (e: React.DragEvent, folderId: string | null) => { e.preventDefault(); e.stopPropagation(); if (draggedItemId) { setChats(prev => prev.map(c => c.id === draggedItemId ? { ...c, folderId: folderId } : c)); } setDraggedItemId(null); setDropTargetId(null); };
    const handleDragEnter = (e: React.DragEvent, folderId: string | null) => { e.preventDefault(); e.stopPropagation(); setDropTargetId(folderId); }
    const handleDragEnd = () => { setDraggedItemId(null); setDropTargetId(null); };

    // --- Whiteboard & Canvas ---
    const updateWhiteboardTransform = useCallback(() => {
        if (whiteboardRef.current) {
            const { scale, panX, panY } = panZoomRef.current;
            const transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
            whiteboardRef.current.style.transform = transform;
        }
    }, []);

    const getCanvasRelativeCoords = useCallback((e: MouseEvent, element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const { scale, panX, panY } = panZoomRef.current;
        const containerX = e.clientX - rect.left;
        const containerY = e.clientY - rect.top;
        return {
            x: (containerX - panX) / scale,
            y: (containerY - panY) / scale
        };
    }, []);
    
    const setupCanvas = (canvas: HTMLCanvasElement | null, container: HTMLDivElement | null) => { if (!canvas || !container) return; canvas.width = container.clientWidth; canvas.height = container.clientHeight; };
    useEffect(() => {
        const container = whiteboardContainerRef.current; if (!container) return;
        const mainCanvas = canvasRef.current; const previewCanvas = previewCanvasRef.current;
        setupCanvas(mainCanvas, container); setupCanvas(previewCanvas, container);
        const resizeObserver = new ResizeObserver(() => { if (mainCanvas && previewCanvas && container) { const mainData = mainCanvas.toDataURL(); setupCanvas(mainCanvas, container); setupCanvas(previewCanvas, container); redrawCanvasFromHistory(mainData); } });
        resizeObserver.observe(container);
        const dataUrl = activeChat?.drawingHistory?.[activeChat.drawingHistoryIndex ?? -1];
        if (dataUrl) redrawCanvasFromHistory(dataUrl);
        else if(mainCanvas) mainCanvas.getContext('2d')?.clearRect(0,0,mainCanvas.width, mainCanvas.height);
        return () => resizeObserver.disconnect();
    }, [activeChat?.id]); // eslint-disable-line

    const getLineDash = (style: 'solid' | 'dashed' | 'dotted', width: number): number[] => {
        const scaledWidth = Math.max(1, width / panZoomRef.current.scale);
        switch (style) {
            case 'dashed': return [scaledWidth * 3, scaledWidth * 2];
            case 'dotted': return [scaledWidth, scaledWidth * 1.5];
            case 'solid': default: return [];
        }
    };
    
    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement; if (target.closest('.visual-card')) return;
        const container = whiteboardContainerRef.current; if (!container) return;
        
        if (activeTool === 'select') { panZoomRef.current.isPanning = true; panZoomRef.current.startPanX = e.clientX - panZoomRef.current.panX; panZoomRef.current.startPanY = e.clientY - panZoomRef.current.panY; }
        else { 
            const coords = getCanvasRelativeCoords(e.nativeEvent, container);
            setIsDrawing(true); 
            drawStartCoords.current = coords; 
            const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return;
            if (['pen', 'highlighter', 'eraser'].includes(activeTool)) { 
                const { lineWidth, strokeStyle, globalCompositeOperation } = getBrushStyle(); 
                ctx.lineWidth = lineWidth / panZoomRef.current.scale; 
                ctx.strokeStyle = strokeStyle; 
                ctx.globalCompositeOperation = globalCompositeOperation; 
                ctx.setLineDash(getLineDash(lineStyle, lineWidth));
                ctx.lineCap = 'round'; 
                ctx.lineJoin = 'round'; 
                ctx.beginPath(); 
                ctx.moveTo(coords.x, coords.y); 
            }
        }
    };
    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (panZoomRef.current.isPanning) { panZoomRef.current.panX = e.clientX - panZoomRef.current.startPanX; panZoomRef.current.panY = e.clientY - panZoomRef.current.startPanY; updateWhiteboardTransform(); }
        else if (isDrawing) {
            const mainCtx = canvasRef.current?.getContext('2d'); const previewCtx = previewCanvasRef.current?.getContext('2d');
            const container = whiteboardContainerRef.current;
            if (!mainCtx || !previewCtx || !previewCanvasRef.current || !container) return;
            const coords = getCanvasRelativeCoords(e.nativeEvent, container);

            if (['pen', 'highlighter', 'eraser'].includes(activeTool)) { mainCtx.lineTo(coords.x, coords.y); mainCtx.stroke(); }
            else if (['rectangle', 'ellipse', 'line', 'arrow', 'notepad'].includes(activeTool)) {
                previewCtx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
                const { lineWidth, strokeStyle } = getBrushStyle(); 
                previewCtx.lineWidth = lineWidth / panZoomRef.current.scale; 
                previewCtx.strokeStyle = strokeStyle;
                previewCtx.setLineDash(getLineDash(lineStyle, lineWidth));
                previewCtx.lineCap = 'round';
                previewCtx.lineJoin = 'round';
                previewCtx.beginPath();
                if (['rectangle', 'notepad'].includes(activeTool)) previewCtx.rect(drawStartCoords.current.x, drawStartCoords.current.y, coords.x - drawStartCoords.current.x, coords.y - drawStartCoords.current.y);
                else if (activeTool === 'ellipse') previewCtx.ellipse(drawStartCoords.current.x + (coords.x - drawStartCoords.current.x) / 2, drawStartCoords.current.y + (coords.y - drawStartCoords.current.y) / 2, Math.abs((coords.x - drawStartCoords.current.x) / 2), Math.abs((coords.y - drawStartCoords.current.y) / 2), 0, 0, 2 * Math.PI);
                else if (activeTool === 'line') { previewCtx.moveTo(drawStartCoords.current.x, drawStartCoords.current.y); previewCtx.lineTo(coords.x, coords.y); }
                else if (activeTool === 'arrow') {
                    previewCtx.moveTo(drawStartCoords.current.x, drawStartCoords.current.y);
                    previewCtx.lineTo(coords.x, coords.y);
                    const headlen = 10 / panZoomRef.current.scale;
                    const dx = coords.x - drawStartCoords.current.x;
                    const dy = coords.y - drawStartCoords.current.y;
                    const angle = Math.atan2(dy, dx);
                    previewCtx.moveTo(coords.x, coords.y);
                    previewCtx.lineTo(coords.x - headlen * Math.cos(angle - Math.PI / 6), coords.y - headlen * Math.sin(angle - Math.PI / 6));
                    previewCtx.moveTo(coords.x, coords.y);
                    previewCtx.lineTo(coords.x - headlen * Math.cos(angle + Math.PI / 6), coords.y - headlen * Math.sin(angle + Math.PI / 6));
                }
                previewCtx.stroke();
            }
        }
    };
    const handleCanvasMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
        if (panZoomRef.current.isPanning) { panZoomRef.current.isPanning = false; }
        else if (isDrawing) {
            setIsDrawing(false); 
            const mainCanvas = canvasRef.current; const mainCtx = mainCanvas?.getContext('2d'); 
            const previewCanvas = previewCanvasRef.current; const previewCtx = previewCanvas?.getContext('2d');
            const container = whiteboardContainerRef.current;
            if (!mainCtx || !previewCtx || !previewCanvas || !mainCanvas || !container) return;
            
            const endCoords = getCanvasRelativeCoords(e.nativeEvent, container);
            const startCoords = drawStartCoords.current;
            const width = Math.abs(endCoords.x - startCoords.x);
            const height = Math.abs(endCoords.y - startCoords.y);
            const distance = Math.sqrt(width * width + height * height);

            if (activeTool === 'text' && distance < 5) { // Single click
                previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                const newCard: VisualCard = {
                    id: `card-${Date.now()}`, type: 'text', keyword: 'Text', text: 'Start typing...',
                    status: VisualCardStatus.Loaded, position: { top: startCoords.y - 10, left: startCoords.x - 10 }, rotation: 0,
                    backgroundColor: 'transparent', width: 200, height: 50, newlyCreated: true,
                };
                updateActiveChat(c => ({ ...c, visualCards: [...c.visualCards, newCard] }));
                setActiveTool('select');
            } else if (activeTool === 'notepad') { // Drag to create
                previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                if (width > 10 && height > 10) {
                    const newCard: VisualCard = {
                        id: `card-${Date.now()}`, type: 'text', keyword: 'New Note', text: 'Double click to edit...',
                        status: VisualCardStatus.Loaded, position: { top: Math.min(startCoords.y, endCoords.y), left: Math.min(startCoords.x, endCoords.x) },
                        rotation: Math.random() * 4 - 2, backgroundColor: '#fef9c3', width, height,
                    };
                    updateActiveChat(c => ({ ...c, visualCards: [...c.visualCards, newCard] }));
                }
                setActiveTool('select');
            } else if (['rectangle', 'ellipse', 'line', 'arrow'].includes(activeTool)) { 
                mainCtx.drawImage(previewCanvas, 0, 0); 
                previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height); 
                saveCanvasState();
            } else { // Pen, highlighter, eraser
                 saveCanvasState();
            }

        }
    };
    
    useEffect(() => {
        const container = whiteboardContainerRef.current;
        if (!container) return;
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const pz = panZoomRef.current;
            if (e.ctrlKey || e.metaKey) { // Zoom
                const zoomIntensity = 0.1;
                const direction = e.deltaY < 0 ? 1 : -1;
                const scaleFactor = Math.exp(direction * zoomIntensity);
                const rect = container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const newPanX = mouseX - (mouseX - pz.panX) * scaleFactor;
                const newPanY = mouseY - (mouseY - pz.panY) * scaleFactor;
                pz.scale *= scaleFactor;
                pz.panX = newPanX;
                pz.panY = newPanY;
            } else { pz.panX -= e.deltaX; pz.panY -= e.deltaY; } // Pan
            updateWhiteboardTransform();
        };
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [updateWhiteboardTransform]);

    const handleZoom = (direction: 'in' | 'out') => {
        const pz = panZoomRef.current;
        const container = whiteboardContainerRef.current;
        if (!container) return;

        const zoomIntensity = 0.2;
        const scaleFactor = direction === 'in' ? 1 + zoomIntensity : 1 / (1 + zoomIntensity);
        
        const rect = container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        pz.panX = centerX - (centerX - pz.panX) * scaleFactor;
        pz.panY = centerY - (centerY - pz.panY) * scaleFactor;
        pz.scale *= scaleFactor;

        updateWhiteboardTransform();
    };
    const handleToggleFullScreen = () => {
        const elem = document.documentElement; // Full screen the whole app
        if (!document.fullscreenElement) {
            elem.requestFullscreen().catch(err => {
                alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    const saveCanvasState = useCallback(() => {
        if (!canvasRef.current || !activeChat) return;
        const url = canvasRef.current.toDataURL();
        const newHistory = (activeChat.drawingHistory ?? []).slice(0, (activeChat.drawingHistoryIndex ?? -1) + 1);
        newHistory.push(url);
        updateActiveChat(c => ({ ...c, drawingHistory: newHistory, drawingHistoryIndex: newHistory.length - 1 }));
    }, [activeChat]); // eslint-disable-line
    const redrawCanvasFromHistory = useCallback((dataUrl: string) => {
        const canvas = canvasRef.current; const ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return;
        const img = new Image(); img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); }; img.src = dataUrl;
    }, []);
    const handleUndo = () => { if (!activeChat || (activeChat.drawingHistoryIndex ?? 0) <= 0) return; const newIndex = (activeChat.drawingHistoryIndex ?? 0) - 1; updateActiveChat(c => ({ ...c, drawingHistoryIndex: newIndex })); redrawCanvasFromHistory(activeChat.drawingHistory![newIndex]); };
    const handleRedo = () => { if (!activeChat || (activeChat.drawingHistoryIndex ?? -1) >= (activeChat.drawingHistory?.length ?? 0) - 1) return; const newIndex = (activeChat.drawingHistoryIndex ?? -1) + 1; updateActiveChat(c => ({...c, drawingHistoryIndex: newIndex })); redrawCanvasFromHistory(activeChat.drawingHistory![newIndex]); };
    const handleWipeWhiteboard = () => {
        if (!activeChat || !canvasRef.current) return;
        if (!window.confirm("Are you sure you want to clear the entire whiteboard? This action can be undone.")) {
            return;
        }
        updateActiveChat(c => ({ ...c, visualCards: [] }));
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            saveCanvasState();
        }
    };

    // --- Context Panel Resizing ---
    const handleResizeMouseDown = (e: React.MouseEvent) => { isResizingRef.current = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; };
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => { if (isResizingRef.current) { setContextPanelWidth(prev => Math.max(300, Math.min(800, window.innerWidth - e.clientX))); } };
        const handleMouseUp = () => { isResizingRef.current = false; document.body.style.cursor = 'default'; document.body.style.userSelect = 'auto'; };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, []);


    // --- File Handling & Content Generation ---
    const handleParseFile = async (file: File): Promise<{text: string, type: UploadedFile['type'], url?: string}> => {
        const fileType = file.type; const fileName = file.name.toLowerCase();
        if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) { const fileUrl = URL.createObjectURL(file); const ab = await file.arrayBuffer(); const pdf = await window.pdfjsLib.getDocument(ab).promise; return { text: (await Promise.all(Array.from({length: pdf.numPages}, async (_, i) => { const page = await pdf.getPage(i+1); const content = await page.getTextContent(); return content.items.map((item: any) => item.str).join(' '); }))).join('\n\n'), type: 'pdf', url: fileUrl}; }
        if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) { const ab = await file.arrayBuffer(); return { text: (await window.mammoth.extractRawText({ arrayBuffer: ab })).value, type: 'docx'}; }
        if (fileType === 'text/plain' || fileName.endsWith('.txt')) { return {text: await file.text(), type: 'txt'}; }
        if (fileType.startsWith('image/')) { return { text: '', type: fileType.includes('png') ? 'png' : 'jpeg', url: URL.createObjectURL(file)}; }
        throw new Error('Unsupported file type');
    };
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, target: 'context' | 'whiteboard') => {
        const file = event.target.files?.[0]; if (!file || !activeChatId || !activeChat) { if (event.target) event.target.value = ''; return; }
        setStatus(`Processing ${file.name}...`);
        try { 
            const { text, type, url } = await handleParseFile(file);
            const newFile: UploadedFile = { id: `file-${Date.now()}`, name: file.name, type, content: text, url };
            updateActiveChat(c => ({...c, uploadedFiles: [...(c.uploadedFiles || []), newFile] }));

            if (target === 'context') { 
                updateActiveChat(c => ({ ...c, contextText: (c.contextText + '\n\n' + text).trim() })); 
                setStatus(`Successfully imported content from ${file.name}.`); 
                setActiveFileId(newFile.id); 
                setActiveContextTab('files'); 

                if (text && ['pdf', 'docx', 'txt'].includes(type) && notepadGenerationCount > 0) {
                    setStatus(<span><SparkleIcon /> Generating summary notes from {file.name}...</span>);
                    try {
                        const notes = await geminiService.generateNotepadsFromText(text, notepadGenerationCount);
                        if (notes.length > 0) {
                            let currentCards = [...(activeChat.visualCards || [])];
                            const newNotepadCards: VisualCard[] = [];
                            for (const note of notes) {
                                const newCard: VisualCard = {
                                    id: `card-${Date.now()}-${Math.random()}`,
                                    type: 'text',
                                    keyword: note.title,
                                    text: note.content,
                                    status: VisualCardStatus.Loaded,
                                    position: findNextLogicalCardPosition(currentCards),
                                    rotation: Math.random() * 4 - 2,
                                    backgroundColor: '#fef9c3', // Sticky note yellow
                                };
                                newNotepadCards.push(newCard);
                                currentCards.push(newCard); // Update for next position calculation
                            }
                            updateActiveChat(c => ({ ...c, visualCards: [...c.visualCards, ...newNotepadCards] }));
                            addToast(`Added ${notes.length} summary notes to the whiteboard.`, 'success');
                            setStatus("Ready.");
                        }
                    } catch (err) {
                        console.error("Failed to generate notepads from file", err);
                        setStatus(`Failed to generate notes from ${file.name}.`);
                    }
                }
            } else { 
                const position = findNextLogicalCardPosition(activeChat.visualCards);
                const newCard: VisualCard = { 
                    id: `card-${Date.now()}`, 
                    type: type.startsWith('image/') ? 'image' : 'file', 
                    keyword: file.name, 
                    status: VisualCardStatus.Loaded, 
                    imageUrl: newFile.url, 
                    position: position,
                    rotation: 0
                }; 
                updateActiveChat(c => ({...c, visualCards: [...c.visualCards, newCard]})); setStatus(`Added ${file.name} to whiteboard.`); 
            }
        } catch (error) { console.error('Error processing file:', error); setStatus(`Failed to process ${file.name}.`); }
        finally { if (event.target) event.target.value = ''; }
    };
    
    const findNextLogicalCardPosition = (existingCards: VisualCard[]): { top: number, left: number } => {
        const { panX, panY, scale } = panZoomRef.current;
        const container = whiteboardContainerRef.current;
        if (!container) return { top: 100, left: 100 };

        const viewWidth = container.clientWidth / scale;
        const viewHeight = container.clientHeight / scale;
        const viewLeft = -panX / scale;
        const viewTop = -panY / scale;

        const CARD_WIDTH = 220;
        const CARD_HEIGHT = 220;
        const PADDING = 40;

        const existingRects = existingCards.map(card => {
            const width = card.width || CARD_WIDTH;
            const height = card.height || CARD_HEIGHT;
            return {
                left: card.position.left - PADDING / 2,
                top: card.position.top - PADDING / 2,
                right: card.position.left + width + PADDING / 2,
                bottom: card.position.top + height + PADDING / 2,
            };
        });

        const checkOverlap = (newRect: {left: number, top: number, right: number, bottom: number}) => {
            for (const rect of existingRects) {
                if (newRect.left < rect.right && newRect.right > rect.left &&
                    newRect.top < rect.bottom && newRect.bottom > rect.top) {
                    return true;
                }
            }
            return false;
        };

        for (let row = 0; row < 20; row++) {
            for (let col = 0; col < 10; col++) {
                const potentialLeft = viewLeft + PADDING + col * (CARD_WIDTH + PADDING);
                const potentialTop = viewTop + PADDING + row * (CARD_HEIGHT + PADDING);

                if (potentialLeft > viewLeft + viewWidth) break;
                
                const newCardRect = {
                    left: potentialLeft,
                    top: potentialTop,
                    right: potentialLeft + CARD_WIDTH,
                    bottom: potentialTop + CARD_HEIGHT,
                };
                
                if (!checkOverlap(newCardRect)) {
                    return { top: potentialTop, left: potentialLeft };
                }
            }
        }
        
        return { top: viewTop + PADDING, left: viewLeft + PADDING + Math.random() * 50 }; 
    };

    const handleAddVisualToWhiteboard = (visual: GeneratedVisual) => {
        if (!activeChat || !visual.imageUrl) return;
        const newCard: VisualCard = {
            id: `card-${Date.now()}-${visual.keyword}`,
            type: 'ai',
            keyword: visual.keyword,
            status: VisualCardStatus.Loaded,
            imageUrl: visual.imageUrl,
            position: findNextLogicalCardPosition(activeChat.visualCards),
            rotation: Math.random() * 8 - 4
        };
        updateActiveChat(c => ({...c, visualCards: [...c.visualCards, newCard]}));
    };

    const getBrushStyle = () => {
        switch(activeTool) {
            case 'pen': return { lineWidth: strokeWidth, strokeStyle: drawColor, globalCompositeOperation: 'source-over' as GlobalCompositeOperation };
            // The 'multiply' operation simulates the effect of a real-world highlighter.
            case 'highlighter': return { lineWidth: strokeWidth, strokeStyle: drawColor, globalCompositeOperation: 'multiply' as GlobalCompositeOperation };
            case 'eraser': return { lineWidth: strokeWidth * 2, strokeStyle: '#000', globalCompositeOperation: 'destination-out' as GlobalCompositeOperation };
            case 'text': return { lineWidth: 1, strokeStyle: '#60a5fa', globalCompositeOperation: 'source-over' as GlobalCompositeOperation }; // For preview rect
            case 'notepad': return { lineWidth: 1, strokeStyle: '#facc15', globalCompositeOperation: 'source-over' as GlobalCompositeOperation }; // For preview rect
            default: return { lineWidth: strokeWidth, strokeStyle: drawColor, globalCompositeOperation: 'source-over' as GlobalCompositeOperation };
        }
    };
    
    // --- Speech Recognition ---
    useEffect(() => {
        if (!SpeechRecognition) { console.warn("Speech Recognition not supported."); return; }
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (event: any) => {
            let interimTranscript = '';
            let finalTranscriptFromEvent = '';
    
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const transcriptPart = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscriptFromEvent += transcriptPart;
                } else {
                    interimTranscript += transcriptPart;
                }
            }
    
            if (finalTranscriptFromEvent) {
                finalTranscriptRef.current += finalTranscriptFromEvent.trim() + ' ';
            }
            
            setLiveTranscript(finalTranscriptRef.current + interimTranscript);
        };

        recognition.onerror = (event: any) => { console.error("Speech recognition error", event.error); setStatus(`Speech recognition error: ${event.error}`); };
        recognition.onend = () => { if (recognitionOnEndCallbackRef.current) recognitionOnEndCallbackRef.current(); };
        recognitionRef.current = recognition;
    }, []);

    const startRecording = () => {
        if (!recognitionRef.current) return;
        setLiveTranscript('');
        finalTranscriptRef.current = '';

        setIsRecording(true);
        setIsPaused(false);
        setSeconds(0);
        setActiveContextTab('transcription');
    
        recognitionRef.current.start();
        timerIntervalRef.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
        recognitionOnEndCallbackRef.current = startRecording;
    };

    const endCurrentRecordingSegment = useCallback(() => {
        if (!recognitionRef.current) return;
        recognitionOnEndCallbackRef.current = undefined;
        recognitionRef.current.stop();
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        const capturedText = finalTranscriptRef.current.trim();
        if (capturedText) {
            updateActiveChat(c => {
                const newContextText = (c.contextText.trim() ? c.contextText + ' ' : '') + capturedText;
                return { ...c, contextText: newContextText };
            });
        }
    }, [activeChatId]);

    const stopRecording = () => {
        endCurrentRecordingSegment();
        setIsRecording(false);
        setIsPaused(false);
    };
    
    const pauseRecording = () => {
        endCurrentRecordingSegment();
        setIsPaused(true);
    };
    
    const resumeRecording = () => {
        if (!recognitionRef.current) return;
        setIsPaused(false);
        recognitionRef.current.start();
        timerIntervalRef.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
        recognitionOnEndCallbackRef.current = startRecording;
    };
    
    useEffect(() => {
        if (activeTool === 'pen' || activeTool === 'highlighter') {
            setLastDrawingTool(activeTool);
        }
    }, [activeTool]);

    const handleColorClick = (color: string) => {
        setDrawColor(color);
        setActiveTool(lastDrawingTool);
    };

    const allChats = chats.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const filteredChats = allChats.filter(c => c.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const allFolders = folders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const renderChatList = (chatList: Chat[]) => {
        return chatList.map(chat => (
            <div key={chat.id} onDragEnd={handleDragEnd}>
                <ChatItem 
                    chat={chat} 
                    isActive={activeChatId === chat.id} 
                    onSelect={() => setActiveChatId(chat.id)} 
                    onDelete={() => handleDeleteChat(chat.id)} 
                    onDragStart={handleDragStart} 
                />
                {activeChatId === chat.id && (
                    <div className="pl-8 pr-2 pb-1 space-y-1">
                        <div className="flex items-center gap-2 w-full text-left p-1 text-xs text-gray-500 rounded">
                            <GridIcon />
                            <span className="truncate">Whiteboard</span>
                        </div>
                        <button onClick={() => { setIsContextPanelVisible(true); setActiveContextTab('notes'); }} className="flex items-center gap-2 w-full text-left p-1 text-xs text-gray-500 hover:bg-slate-200 rounded">
                           <NoteIcon />
                           <span className="truncate">Source Notes</span>
                        </button>
                        {(chat.uploadedFiles && chat.uploadedFiles.length > 0) && chat.uploadedFiles.map(file => (
                            <button key={file.id} onClick={() => { setIsContextPanelVisible(true); setActiveContextTab('files'); setActiveFileId(file.id); }} className="flex items-center gap-2 w-full text-left p-1 text-xs text-gray-500 hover:bg-slate-200 rounded">
                                <FileIcon />
                                <span className="truncate">{file.name}</span>
                            </button>
                        ))}
                         {(chat.generatedVisuals && chat.generatedVisuals.length > 0) && chat.generatedVisuals.map((visual, index) => (
                            <button key={visual.id} onClick={() => handleAddVisualToWhiteboard(visual)} disabled={visual.status !== 'loaded'} className="flex items-center gap-2 w-full text-left p-1 text-xs text-gray-500 hover:bg-slate-200 rounded disabled:opacity-50 disabled:cursor-not-allowed">
                                {visual.status === 'loading' ? <div className='status-loader !w-3.5 !h-3.5 !mr-0'></div> : <ImageIcon />}
                                <span className="truncate flex-grow">{visual.keyword}</span>
                                {visual.status === 'error' && <span className="text-red-500 text-xs">Failed</span>}
                            </button>
                        ))}
                        {(chat.quizzes && chat.quizzes.length > 0) && chat.quizzes.map((quiz, index) => (
                            <button key={quiz.id} onClick={() => setActiveModalContent({ type: 'quiz', data: quiz })} className="flex items-center gap-2 w-full text-left p-1 text-xs text-gray-500 hover:bg-slate-200 rounded">
                                <QuizIcon />
                                <span className="truncate">Quiz #{index + 1}</span>
                            </button>
                        ))}
                         {(chat.roadmaps && chat.roadmaps.length > 0) && chat.roadmaps.map((roadmap, index) => (
                            <button key={roadmap.id} onClick={() => setActiveModalContent({ type: 'roadmap', data: roadmap })} className="flex items-center gap-2 w-full text-left p-1 text-xs text-gray-500 hover:bg-slate-200 rounded">
                                <RoadmapIcon />
                                <span className="truncate">Roadmap #{index + 1}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        ));
    };

    const isAiDisabled = !activeChat?.contextText || activeChat.contextText.length < 100;
    const formatTime = (totalSeconds: number) => { const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`; };

    return (
    <div className="w-screen h-screen flex bg-slate-50 text-slate-800">
        {isSettingsOpen && <SettingsModal streak={studyStreak} goal={activeChat?.studyGoal || ''} setGoal={val => updateActiveChat(c => ({...c, studyGoal: val}))} reminder={activeChat?.reminderTime || '09:00'} setReminder={val => updateActiveChat(c => ({...c, reminderTime: val}))} onClose={() => setIsSettingsOpen(false)} summaryDetail={summaryDetail} setSummaryDetail={setSummaryDetail} notepadGenerationCount={notepadGenerationCount} setNotepadGenerationCount={setNotepadGenerationCount} />}
        {activeModalContent?.type === 'quiz' && <QuizModal quiz={activeModalContent.data} onClose={() => setActiveModalContent(null)} />}
        {activeModalContent?.type === 'roadmap' && <RoadmapModal roadmap={activeModalContent.data} onSetStudyGoal={(goal) => {updateActiveChat(c => ({...c, studyGoal: goal})); setStatus("Study goal updated!");}} onClose={() => setActiveModalContent(null)} />}
        {activeModalContent?.type === 'share' && <ShareModal chat={activeChat} whiteboardEl={whiteboardRef.current} onClose={() => setActiveModalContent(null)} />}
        {isNewSessionModalOpen && <NewSessionModal onClose={() => setIsNewSessionModalOpen(false)} onRecord={() => { startRecording(); setIsNewSessionModalOpen(false); }} onUpload={() => { (fileInputRef.current as any)._target = 'context'; fileInputRef.current?.click(); setIsNewSessionModalOpen(false); }} />}
        <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e, (e.target as any)._target)} className="hidden" accept=".pdf,.txt,.docx,.png,.jpg,.jpeg" />
        
        <div className="absolute top-4 right-4 z-[100] w-80 space-y-2">
            {toasts.map(toast => (
                <ToastNotification key={toast.id} toast={toast} onDismiss={id => setToasts(ts => ts.filter(t => t.id !== id))} />
            ))}
        </div>

        <aside className={`bg-slate-100 border-r border-slate-200 flex flex-col h-full shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'w-0' : 'w-64'}`}>
            <div className="p-4 border-b border-slate-200 flex-shrink-0">
                <CanopyLogo className="h-8 w-auto" />
            </div>
            <div className="p-3 flex items-center gap-2 flex-shrink-0">
                <div className="relative flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon /></div>
                    <input type="text" placeholder="Search sessions..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-1.5 text-sm border-slate-300 bg-white placeholder-slate-400 rounded-md focus:ring-1 focus:ring-[#2f7400] focus:border-[#2f7400]" />
                </div>
                 <button onClick={handleNewFolder} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md shrink-0" title="New Folder">
                    <NewFolderIcon />
                </button>
                 <button onClick={() => setIsSidebarCollapsed(true)} title="Collapse Sidebar" className="p-2 text-slate-500 hover:bg-slate-200 rounded-md shrink-0"><SidebarCollapseIcon/></button>
            </div>
            <nav className="flex-1 overflow-y-auto sidebar-scroll px-3" onDragOver={handleDragOver}>
                 {allFolders.map(folder => (
                     <FolderItem key={folder.id} folder={folder} onRename={handleRenameFolder} onDelete={() => handleDeleteFolder(folder.id)} isCollapsed={collapsedFolders.has(folder.id)} onToggleCollapse={() => toggleFolderCollapse(folder.id)} onDragEnter={(e) => handleDragEnter(e, folder.id)} onDrop={(e) => handleDrop(e, folder.id)} isDropTarget={dropTargetId === folder.id}>
                        {renderChatList(filteredChats.filter(c => c.folderId === folder.id))}
                     </FolderItem>
                 ))}
                 <div className={`mt-2 rounded-md transition-colors ${dropTargetId === null ? 'bg-green-100' : ''}`} onDragEnter={(e) => handleDragEnter(e, null)} onDrop={(e) => handleDrop(e, null)} >
                     {renderChatList(filteredChats.filter(c => !c.folderId))}
                 </div>
            </nav>
            <div className="p-3 border-t border-slate-200 flex items-center gap-2 flex-shrink-0">
                <button onClick={handleNewChat} className="flex-grow flex items-center justify-center gap-2 p-2.5 bg-[#2f7400] text-white rounded-lg text-sm font-semibold hover:bg-[#255b00] transition-colors"><NewChatIcon />New Session</button>
            </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
            {!activeChat ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-lg">Select or create a session to begin</div>
            ) : (
                <>
                    <header className="p-3 bg-white border-b border-slate-200 flex justify-between items-center z-20 shrink-0 gap-4 h-16">
                        <div className='flex items-center gap-2 flex-1 min-w-0'>
                            {isSidebarCollapsed && <button onClick={() => setIsSidebarCollapsed(false)} title="Expand Sidebar" className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><div className='transform rotate-180'><SidebarCollapseIcon/></div></button>}
                            <input type="text" value={activeChat.title} onChange={e => updateActiveChat(c => ({...c, title: e.target.value}))} className="text-xl font-bold text-slate-800 bg-transparent focus:outline-none focus:ring-2 focus:ring-[#2f7400] rounded-md -ml-2 px-2 py-1 w-full min-w-0" />
                        </div>
                                            
                        <div className="flex items-center gap-2 shrink-0">
                             <button onClick={() => setActiveModalContent({type: 'share'})} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg" title="Share or Export"><ShareIcon/></button>
                             <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg" title="Settings"><SettingsIcon/></button>
                             <div className="w-px h-6 bg-slate-200 mx-1"></div>
                             <button onClick={() => setIsContextPanelVisible(!isContextPanelVisible)} title={isContextPanelVisible ? "Hide Context Panel" : "Show Context Panel"} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                                <div className={`transform transition-transform ${isContextPanelVisible ? '' : 'rotate-180'}`}><SidebarCollapseIcon/></div>
                            </button>
                        </div>
                    </header>

                    <div className="bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-4 z-10 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-slate-100 rounded-md flex items-center gap-2 text-sm font-semibold text-slate-600">
                                <SparkleIcon /> AI Tools
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-sm">
                                <button onClick={handleGenerateSummary} disabled={isAiDisabled} className="px-3 py-1.5 rounded-md flex items-center gap-2 bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"><NoteIcon /> Summary</button>
                                <button onClick={handleGenerateVisuals} disabled={isAiDisabled} className="px-3 py-1.5 rounded-md flex items-center gap-2 bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"><PaletteIcon /> Visuals</button>
                                <button onClick={() => handleGenerateQuiz(true)} disabled={isAiDisabled || isGeneratingQuiz} className="px-3 py-1.5 rounded-md flex items-center gap-2 bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">{isGeneratingQuiz ? <div className='status-loader'></div> : <QuizIcon />} Quiz</button>
                                <button onClick={() => handleGenerateRoadmap(true)} disabled={isAiDisabled || isGeneratingRoadmap} className="px-3 py-1.5 rounded-md flex items-center gap-2 bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">{isGeneratingRoadmap ? <div className='status-loader'></div> : <RoadmapIcon />} Roadmap</button>
                            </div>
                        </div>
                        <div className="text-sm text-slate-500 flex-shrink-0 min-w-0">
                            <div className="truncate">{status}</div>
                        </div>
                    </div>


                    <main className="flex-grow w-full flex overflow-hidden bg-slate-200/50">
                        <div className="flex-grow h-full flex flex-col relative p-4 pr-2">
                            <WhiteboardToolbar activeTool={activeTool} setActiveTool={setActiveTool} drawColor={drawColor} setDrawColor={setDrawColor} strokeWidth={strokeWidth} setStrokeWidth={setStrokeWidth} lineStyle={lineStyle} setLineStyle={setLineStyle} onUndo={handleUndo} onRedo={handleRedo} canUndo={(activeChat.drawingHistoryIndex ?? 0) > 0} canRedo={(activeChat.drawingHistoryIndex ?? -1) < (activeChat.drawingHistory?.length ?? 0) -1} onAddFile={() => {(fileInputRef.current as any)._target = 'whiteboard'; fileInputRef.current?.click()}} onBackgroundChange={() => updateActiveChat(c => ({ ...c, whiteboardBackground: c.whiteboardBackground === 'plain' ? 'grid' : c.whiteboardBackground === 'grid' ? 'lined' : 'plain' }))} onColorClick={handleColorClick} onWipe={handleWipeWhiteboard} />
                            <div ref={whiteboardContainerRef} onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp} className={`flex-grow w-full h-full overflow-hidden relative bg-white rounded-b-lg border border-slate-200 shadow-sm ${activeChat?.whiteboardBackground === 'grid' ? 'bg-grid' : ''} ${activeChat?.whiteboardBackground === 'lined' ? 'bg-lined' : ''} cursor-${activeTool === 'select' ? 'grab' : 'crosshair'} active:cursor-${activeTool === 'select' ? 'grabbing' : 'crosshair'}`}>
                                <div className="absolute bottom-4 left-4 z-30 flex items-center gap-1 bg-white p-1 rounded-lg shadow-md border border-slate-200">
                                    <button onClick={() => handleZoom('in')} className="p-2 rounded-md hover:bg-slate-100" title="Zoom In"><ZoomInIcon/></button>
                                    <button onClick={() => handleZoom('out')} className="p-2 rounded-md hover:bg-slate-100" title="Zoom Out"><ZoomOutIcon/></button>
                                    <button onClick={handleToggleFullScreen} className="p-2 rounded-md hover:bg-slate-100" title="Full Screen"><FullScreenIcon/></button>
                                </div>
                                 <div ref={whiteboardRef} className="w-full h-full transform-origin-top-left relative pointer-events-auto">
                                    {activeChat.visualCards.map(card => <VisualCardComponent key={card.id} card={card} scale={panZoomRef.current.scale} onDelete={(id) => updateActiveChat(c => ({...c, visualCards: c.visualCards.filter(v => v.id !== id)}))} onUpdate={updatedCard => updateActiveChat(c => ({...c, visualCards: c.visualCards.map(v => v.id === updatedCard.id ? updatedCard : v)}))} onRegenerate={handleRegenerateVisual} />)}
                                    <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none"></canvas>
                                    <canvas ref={previewCanvasRef} className="absolute top-0 left-0 w-full h-full z-20 pointer-events-none"></canvas>
                                </div>
                            </div>
                        </div>
                         
                        {isContextPanelVisible && (
                            <>
                            <div onMouseDown={handleResizeMouseDown} className="w-1.5 h-full cursor-col-resize flex items-center justify-center shrink-0">
                                <div className="w-px h-12 bg-slate-300 rounded-full"></div>
                            </div>
                            <aside style={{ width: contextPanelWidth }} className="h-full flex flex-col bg-white shrink-0 p-4 pl-2">
                                <div className="bg-slate-100 rounded-lg p-1 flex-grow flex flex-col border border-slate-200/80">
                                    <div className="flex items-center p-2 border-b border-slate-200">
                                        <div className="flex-1 flex-nowrap overflow-x-auto">
                                            <button onClick={() => setActiveContextTab('notes')} className={`px-3 py-1 text-sm rounded-l-md ${activeContextTab === 'notes' ? 'bg-white text-slate-800 shadow-sm' : 'bg-transparent text-slate-500'}`}>Notes</button>
                                            <button onClick={() => setActiveContextTab('transcription')} className={`px-3 py-1 text-sm ${activeContextTab === 'transcription' ? 'bg-white text-slate-800 shadow-sm' : 'bg-transparent text-slate-500'}`}>Transcription</button>
                                            <button onClick={() => setActiveContextTab('files')} className={`px-3 py-1 text-sm rounded-r-md ${activeContextTab === 'files' ? 'bg-white text-slate-800 shadow-sm' : 'bg-transparent text-slate-500'}`}>Files ({activeChat.uploadedFiles?.length || 0})</button>
                                        </div>
                                        <button onClick={() => { (fileInputRef.current as any)._target = 'context'; fileInputRef.current?.click(); }} className="flex items-center gap-2 px-3 py-1 bg-[#2f7400] text-white rounded-md text-sm font-semibold hover:bg-[#255b00] transition-colors shrink-0"><UploadIcon />Add</button>
                                    </div>
                                     <div