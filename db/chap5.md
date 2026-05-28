\chapter{Sprint 3}
\label{chap:sprint3}
%-----------------------------------------------------------------

\section{Introduction}

Sprint 3 covers the document processing and content generation layer, transforming academic content into quizzes, summaries, flashcards, and mock exams through an asynchronous pipeline built on Celery, Redis, and Ollama.
The chapter covers the sprint backlog, use case refinements, design artifacts, AI model integration, and pipeline realization.
\section{Sprint 3 Refinement}
\subsection{Sprint Backlog}

The following table presents the Sprint 3 backlog, grouping all user stories to be implemented along with their priority.
\begin{table}[H]
\centering
\small
\caption{Sprint 3 Product Backlog}

\renewcommand{\arraystretch}{1.35}
\setlength{\tabcolsep}{8pt}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}X|>{\centering\arraybackslash}p{1.5cm}|}
\hline
\rowcolor{gray!15}
\textbf{User Story} & \textbf{Priority} \\
\hline

As a Student, I can upload files (PDF or image) for AI processing. & 3 \\
\hline

As a Student, I can paste or write textual content directly into the platform. & 3 \\
\hline

As a Student, I can generate summaries from uploaded or written content. & 3 \\
\hline

As a Student, I can generate flashcards from uploaded or written content. & 3 \\
\hline

As a Student, I can generate quizzes from uploaded or written content. & 3 \\
\hline

As a Student, I can generate mock exams from uploaded or written content. & 3 \\
\hline

As a Student, I can calculate my score after completing a generated mock exam. & 3 \\
\hline

As a Student, I can configure AI generation settings before generating learning materials. & 3 \\
\hline

As a Student, I can generate a personalized study plan. & 3 \\
\hline

\end{tabularx}

\label{tab:sprint3_backlog}
\end{table}

\section{Sprint 3 Global Use Case Diagram}

Figure~\ref{fig:usecase-sprint3} presents the global use case diagram for Sprint 3, covering: Upload File, Generate Quiz, Generate Mock Exam, Generate Summary, Generate Flashcards, and Generate Study Plan.

\begin{figure}[H]
    \centering
    \includegraphics[width=0.8\textwidth, keepaspectratio]{diags/sprint3/usecase.png}
    \caption{Use Case Diagram — Sprint 3}
    \label{fig:usecase-sprint3}
\end{figure}

\subsection{Use Case Refinement: ``Upload File''}

Table \ref{tab:uc-manageuploads} summarizes the refined interaction flow for managing uploaded academic resources within Cognify.

\begin{longtable}{|>{\raggedright\arraybackslash}p{3cm}|>{\raggedright\arraybackslash}p{11cm}|}

\caption{Use Case Refinement — Upload File}
\label{tab:uc-manageuploads}\\

\hline
\rowcolor{gray!15}
\textbf{Field} & \textbf{Details} \\
\hline
\endfirsthead

\hline
\rowcolor{gray!15}
\textbf{Field} & \textbf{Details} \\
\hline
\endhead

\textbf{Use Case} & Upload File \\
\hline

\textbf{Actor} & Student \\
\hline

\textbf{Pre-condition} & Authenticated student within a subject workspace. \\
\hline

\textbf{Post-condition} & File is stored, registered, and queued for AI processing. \\
\hline

\textbf{Main Flow} &
\begin{enumerate}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item Student uploads a file or inputs text.
    \item System validates authentication, quota, and file format.
    \item File is temporarily staged using a unique identifier.
    \item Metadata is stored in the database.
    \item Material state is set to \textit{PENDING}.
    \item Processing task is dispatched to the asynchronous queue.
    \item Progress updates are streamed to the interface.
\end{enumerate}
\\
\hline

\textbf{Operations} &
\begin{itemize}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item View uploaded file and metadata.
    \item Edit upload title.
    \item Delete uploaded resource.
\end{itemize}
\\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item Unsupported file format.
    \item File exceeds maximum allowed size.
    \item Storage quota exceeded.
    \item Upload or preprocessing failure.
    \item Missing or deleted resource.
\end{itemize}
\\
\hline

\end{longtable}

\subsection{Use Case Refinement: ``Generate Quiz''}

Table~\ref{tab:uc-generatequiz} describes the quiz generation workflow, covering both standard and adaptive modes in Cognify.

\begin{longtable}{|>{\raggedright\arraybackslash}p{3.3cm}|>{\raggedright\arraybackslash}p{10.7cm}|}

\caption{Use Case Refinement — Generate Quiz}
\label{tab:uc-generatequiz}\\

\hline
\rowcolor{gray!15}
\textbf{Field} & \textbf{Details} \\
\hline
\endfirsthead

\hline
\rowcolor{gray!15}
\textbf{Field} & \textbf{Details} \\
\hline
\endhead

\textbf{Use Case} & Generate Quiz \\
\hline

\textbf{Actor} & Student \\
\hline

\textbf{Pre-condition} & At least one academic document is available in the subject workspace. \\
\hline

\textbf{Post-condition} & A quiz is generated, stored, and accessible to the student. \\
\hline

\textbf{Main Flow} &
\begin{enumerate}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item Student selects the \textit{Generate Quiz} option.
    \item Student configures quiz parameters: number of questions, difficulty level, and mode (standard or adaptive).
    \item System retrieves relevant content chunks from the subject's embedded store via cosine similarity search.
    \item The LLM generates questions grounded in the retrieved context.
    \item The quiz is persisted and displayed to the student.
\end{enumerate}
\\
\hline

\textbf{Adaptive Extension} &
\begin{enumerate}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item System initializes the student's performance state for the session.
    \item Each submitted answer is evaluated in real time.
    \item A rule-based controller resolves the difficulty and concept target for the next question using response correctness, performance streak, and average response latency as input signals. The next question is retrieved via cosine similarity search over the subject's embedded chunks, targeting the identified weak concept.
    \item The process continues iteratively until quiz completion.
\end{enumerate}
\\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item AI generation service unavailable.
    \item Quiz session initialization failure.
\end{itemize}
\\
\hline

\end{longtable}
\subsection{Use Case Refinement: ``Generate Summary''}

Table~\ref{tab:uc-generatesummary} describes the summary generation workflow and its adaptive extension for the \textit{Teach Me} mode.

\begin{longtable}{|>{\raggedright\arraybackslash}p{3.3cm}|>{\raggedright\arraybackslash}p{10.7cm}|}

\caption{Use Case Refinement — Generate Summary}
\label{tab:uc-generatesummary}\\

\hline
\rowcolor{gray!15}
\textbf{Field} & \textbf{Details} \\
\hline
\endfirsthead

\hline
\rowcolor{gray!15}
\textbf{Field} & \textbf{Details} \\
\hline
\endhead

\textbf{Use Case} & Generate Summary \\
\hline

\textbf{Actor} & Student \\
\hline

\textbf{Pre-condition} & At least one academic document is available in the subject workspace. \\
\hline

\textbf{Post-condition} & A summary is generated, stored, and accessible to the student. \\
\hline

\textbf{Main Flow} &
\begin{enumerate}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item Student selects the \textit{Summary} generation option.
    \item System retrieves the relevant document content.
    \item Student configures the summary type (teach me, concise, detailed, key concepts, or exam-oriented).
    \item The LLM generates the summary according to the configured mode.
    \item System displays and stores the generated output.
\end{enumerate}
\\
\hline

\textbf{Teach Me Mode Extension} &
\begin{itemize}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item The system retrieves the student's adaptive profile, which encodes a recommended difficulty level derived from blended accuracy estimates and a prioritized list of weak concepts.
    \item These signals are injected into the generation prompt to calibrate explanation depth and conceptual focus.
    \item Concept prioritization reflects retention dynamics: concepts associated with recent incorrect responses are treated as at elevated risk of forgetting and receive expanded coverage in the generated output.
\end{itemize}
\\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item AI generation service unavailable.
    \item Invalid or corrupted input content.
\end{itemize}
\\
\hline

\end{longtable}

\subsection{Use Case Refinement: ``Generate Study Plan''}

Table~\ref{tab:uc-generatestudyplan} describes the study plan generation workflow, in which the system combines the student's adaptive profile with the subject-level concept taxonomy to produce a personalized learning roadmap.

\begin{longtable}{|>{\raggedright\arraybackslash}p{3.3cm}|>{\raggedright\arraybackslash}p{10.7cm}|}

\caption{Use Case Refinement — Generate Study Plan}
\label{tab:uc-generatestudyplan}\\

\hline
\rowcolor{gray!15}
\textbf{Field} & \textbf{Details} \\
\hline
\endfirsthead

\hline
\rowcolor{gray!15}
\textbf{Field} & \textbf{Details} \\
\hline
\endhead

\textbf{Use Case} & Generate Study Plan \\
\hline

\textbf{Actor} & Student \\
\hline

\textbf{Pre-condition} & At least one active subject with generated learning materials and a tracked performance history. \\
\hline

\textbf{Post-condition} & A personalized study plan is generated, stored, and accessible to the student. \\
\hline

\textbf{Main Flow} &
\begin{enumerate}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item Student selects the \textit{Generate Study Plan} option.
    \item System retrieves the student's adaptive profile, including blended accuracy, recommended difficulty, and weak concept list.
    \item System queries the concept taxonomy to identify concepts requiring reinforcement.
    \item The LLM generates a structured study plan prioritizing identified weak concepts, aligned with the recommended difficulty level.
    \item The generated plan is displayed and stored for the student.
\end{enumerate}
\\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item AI generation service unavailable.
    \item Insufficient performance history to build an adaptive profile.
    \item No learning materials available in the subject workspace.
\end{itemize}
\\
\hline

\end{longtable}

\subsection{Use Case Refinement: ``Generate Flashcards''}

Table~\ref{tab:uc-generateflashcards} describes the flashcard generation workflow, including its adaptive mode extension.

\begin{longtable}{|>{\raggedright\arraybackslash}p{3.3cm}|>{\raggedright\arraybackslash}p{10.7cm}|}

\caption{Use Case Refinement — Generate Flashcards}
\label{tab:uc-generateflashcards}\\

\hline
\rowcolor{gray!15}
\textbf{Field} & \textbf{Details} \\
\hline
\endfirsthead

\hline
\rowcolor{gray!15}
\textbf{Field} & \textbf{Details} \\
\hline
\endhead

\textbf{Use Case} & Generate Flashcards \\
\hline

\textbf{Actor} & Student \\
\hline

\textbf{Pre-condition} & At least one academic document is available in the subject workspace. \\
\hline

\textbf{Post-condition} & A set of flashcards is generated, stored, and accessible to the student. \\
\hline

\textbf{Main Flow} &
\begin{enumerate}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item Student selects the \textit{Generate Flashcards} option from the subject workspace.
    \item Student configures generation parameters: number of cards, difficulty level, and optionally enables adaptive mode.
    \item System retrieves relevant content chunks from the subject's embedded store via cosine similarity search.
    \item If adaptive mode is selected, the system resolves the student's current recommended difficulty and weak concepts from the adaptive profile.
    \item The LLM generates front/back flashcard pairs grounded in the retrieved context; the output is validated against the expected schema and repaired if malformed.
    \item Generated flashcards are persisted to the materials table and displayed to the student.
\end{enumerate}
\\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item AI generation service unavailable.
    \item No content chunks indexed for the subject.
    \item LLM output fails schema validation after the maximum number of repair attempts.
\end{itemize}
\\
\hline

\end{longtable}

\subsection{Use Case Refinement: ``Generate Mock Exam''}

Table~\ref{tab:uc-generatemockexam} describes the mock exam generation, submission, and grading workflow in Cognify.

\begin{longtable}{|>{\raggedright\arraybackslash}p{3.3cm}|>{\raggedright\arraybackslash}p{10.7cm}|}

\caption{Use Case Refinement — Generate Mock Exam}
\label{tab:uc-generatemockexam}\\

\hline
\rowcolor{gray!15}
\textbf{Field} & \textbf{Details} \\
\hline
\endfirsthead

\hline
\rowcolor{gray!15}
\textbf{Field} & \textbf{Details} \\
\hline
\endhead

\textbf{Use Case} & Generate Mock Exam \\
\hline

\textbf{Actor} & Student \\
\hline

\textbf{Pre-condition} & At least one academic document is available in the subject workspace. \\
\hline

\textbf{Post-condition} & A mock exam is generated, stored, and graded upon student submission; results are persisted and fed back into the adaptive learner model. \\
\hline

\textbf{Main Flow} &
\begin{enumerate}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item Student selects the \textit{Generate Mock Exam} option and configures parameters: number of questions, question types, difficulty level, topics, optional time limit, and mode (static or adaptive).
    \item System creates a material record with status \textit{PROCESSING}.
    \item System retrieves relevant context chunks from the subject's embedded store using cosine similarity search over the selected topics.
    \item The LLM generates questions across the requested distribution of types; each question is validated, normalized, and deduplicated before acceptance.
    \item The generated exam is persisted to the materials table and an exam session record is initialized in the \texttt{exam\_attempts} table.
    \item Student completes the exam and submits all responses.
    \item System grades each response server-side: choice-based questions are evaluated by index comparison; open-ended responses are scored using a weighted combination of semantic similarity, keyword matching, and concept coverage; fill-in-the-blank responses are checked by normalized exact match; matching questions are evaluated at the pair level.
    \item Final score and per-question breakdown are persisted to \texttt{exam\_attempts}; results are consumed by the adaptive learner model to update \texttt{ConceptMastery} records.
\end{enumerate}
\\
\hline

\textbf{Adaptive Extension} &
\begin{enumerate}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item Engine initializes an adaptive exam session, returning the initial difficulty level and concept target derived from the student's mastery profile.
    \item Questions are generated and delivered in batches of five.
    \item After each batch, submitted answers are graded server-side and the results are forwarded to the adaptive state endpoint, which resolves the difficulty and concept target for the subsequent batch.
    \item New context chunks are retrieved for the next concept via cosine similarity search, and a new batch is generated accordingly.
    \item The cycle continues until the configured total question count is reached.
\end{enumerate}
\\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item AI generation service unavailable.
    \item No academic content indexed for the subject.
    \item Question validation fails after the maximum number of generation attempts.
    \item Adaptive session initialization failure.
\end{itemize}
\\
\hline

\end{longtable}

\section{Sprint 3 Design}

This section presents the class, activity, and sequence diagrams modeling the Sprint 3 document processing and content generation pipeline.

\subsection{Sprint Class Diagram}

Figure~\ref{fig:class-sprint3} presents the principal domain entities and their relationships within the Sprint 3 architecture.

\begin{figure}[H]
    \centering
    \includegraphics[width=\textwidth, height=0.5\textheight ]{diags/sprint3/classdiag.jpg}
    \caption{Class Diagram — Sprint 3}
    \label{fig:class-sprint3}
\end{figure}
\newpage
\subsection{Diagrams Related to the ``Upload File'' Use Case}

Figure~\ref{fig:upload-activity} illustrates the document upload and asynchronous ingestion flow.
\begin{figure}[H]
    \centering
    \includegraphics[
        width=0.8\textwidth,
        height=0.8\textheight,
        keepaspectratio
    ]{diags/sprint3/upload-act.png}
    \caption{Activity Diagram — Upload File}
    \label{fig:upload-activity}
\end{figure}


\subsection{Diagrams Related to the ``Generate Quiz'' Use Case}

\subsubsection*{Activity Diagram: Adaptive Loop}

Figure~\ref{fig:adaptive-activity} illustrates the activity flow executed by the system during an adaptive quiz session.

\begin{figure}[H]
   \centering
   \includegraphics[
       width=0.4\textwidth,
       keepaspectratio
   ]{diags/sprint3/adaptiveLoop-act.png}
    \caption{Activity Diagram — Adaptive Quiz Loop}
    \label{fig:adaptive-activity}
\end{figure}

\subsubsection*{Sequence Diagram: Generate Quiz}

Figure~\ref{fig:quiz-sequence} presents the interactions between system components involved in the quiz generation process.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=\textwidth,
        height=0.8\textheight,
        keepaspectratio
    ]{diags/sprint3/gen_quiz_seq.png}
    \caption{Sequence Diagram — Generate Quiz}
    \label{fig:quiz-sequence}
\end{figure}

\subsection{Diagrams Related to the ``Generate Summary'' Use Case}

\subsubsection*{Activity Diagram: Generate Summary}

Figure~\ref{fig:summary-activity} illustrates the workflow executed by the system to generate a learning summary from the indexed academic content.

\begin{figure}[H]
    \centering
    \includegraphics[width=0.6\textwidth, keepaspectratio]{diags/sprint3/gen_summaryAct.png}
    \caption{Activity Diagram — Generate Summary}
    \label{fig:summary-activity}
\end{figure}

\subsection{Diagrams Related to the ``Generate Study Plan'' Use Case}

\subsubsection*{Sequence Diagram: Generate Study Plan}

Figure~\ref{fig:studyplan-sequence} presents the interactions between system components involved in the study plan generation process.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=\textwidth,
        height=0.8\textheight,
        keepaspectratio
    ]{diags/sprint3/gen_studyplan_seq.png}
    \caption{Sequence Diagram — Generate Study Plan}
    \label{fig:studyplan-sequence}
\end{figure}

\subsection{Diagrams Related to the ``Generate Flashcards'' Use Case}

\subsubsection*{Sequence Diagram: Generate Flashcards}

Figure \ref{fig:flashcards-sequence} presents the interactions between the system components involved in the flashcard generation process, from context retrieval through adaptive profile resolution to LLM generation and persistence.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=\textwidth,
        height=0.8\textheight,
        keepaspectratio
    ]{diags/sprint3/gen_flashcards_seq.png}
    \caption{Sequence Diagram — Generate Flashcards}
    \label{fig:flashcards-sequence}
\end{figure}

\subsection{Diagrams Related to the ``Generate Mock Exam'' Use Case}

\subsubsection*{Sequence Diagram: Generate Mock Exam}

Figure \ref{fig:exam-sequence} presents the interactions between the system components involved in the mock exam generation and grading workflow, covering both static and adaptive execution modes.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=\textwidth,
        height=0.8\textheight,
        keepaspectratio
    ]{diags/sprint3/gen_exam_seq.png}
    \caption{Sequence Diagram — Generate Mock Exam}
    \label{fig:exam-sequence}
\end{figure}

\subsection{Grading and Evaluation System}

Cognify implements two grading mechanisms: real-time formative evaluation for adaptive quizzes, and deferred summative scoring for mock examinations.

\subsubsection*{Quiz Grading: Formative Real-Time Evaluation}

Each answer in an adaptive quiz session is evaluated immediately. Performance signals — correctness, accuracy, streak, and latency — are forwarded to a rule-based controller that selects the difficulty level and concept target for the next question via cosine similarity search over the subject's embedded chunks.
Outcomes are persisted incrementally as \texttt{ConceptMastery} records, updating per-concept accuracy and recommended difficulty in real time.

\subsubsection*{Mock Exam Grading: Summative Deferred Scoring}

All responses are submitted collectively and graded server-side: choice-based questions by index comparison; open-ended responses by weighted semantic similarity, keyword matching, and concept coverage ($\geq 0.8$ threshold); fill-in-the-blank by normalized exact match; and matching at the pair level.
The final score and per-question breakdown are persisted to \texttt{exam\_attempts} and consumed by the adaptive model to update \texttt{ConceptMastery} records.

\section{State of the Art of Existing Solutions: Comparative Analysis}

This section compares AI deployment strategies, embedding models, and LLM backbones considered for Cognify.

\subsection{Deployment Approaches and Technology Overview}

LLMs can be deployed locally (e.g., via Ollama) or through cloud APIs. Semantic retrieval relies on embedding models that encode text into dense vectors for similarity search \cite{reimers2019sentencebert}; generation backbones range from lightweight local models to large proprietary cloud models.

\subsection{Comparative Study}

Tables~\ref{tab:embedding-models} and~\ref{tab:llm-backbones} compare the principal embedding models and LLM backbones evaluated during design \cite{touvron2023llama}.

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.4}
\setlength{\tabcolsep}{8pt}
\caption{Embedding Model Comparison}
\label{tab:embedding-models}
\begin{tabular}{|p{3.5cm}|p{2.5cm}|p{5cm}|p{4cm}|}
\hline
\textbf{Model} & \textbf{Dimensions} & \textbf{Strengths} & \textbf{Weaknesses} \\
\hline
nomic-embed-text & 768 & Efficient, strong semantic retrieval, optimized for local use & Slightly weaker than large proprietary embeddings \\
\hline
text-embedding-3-large & 3072 & State-of-the-art semantic representation quality & Requires paid API access \\
\hline
BGE-large & 1024 & Strong retrieval performance & Higher computational cost \\
\hline
Instructor-XL & 768+ & Instruction-aware embeddings & Slower inference \\
\hline
\end{tabular}
\end{table}


\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.4}
\setlength{\tabcolsep}{8pt}
\caption{Comparison of LLM Backbones}
\label{tab:llm-backbones}
\begin{tabular}{|p{3.5cm}|p{2cm}|p{3cm}|p{3.5cm}|p{3cm}|}
\hline
\textbf{Model} & \textbf{Size} & \textbf{Performance} & \textbf{Local Feasibility} & \textbf{Notes} \\
\hline
Qwen2.5:3B & 3B & Strong structured reasoning & Excellent & Fast inference and lightweight \\
\hline
LLaMA 3 8B & 8B & Strong general reasoning & Medium & Higher computational requirements \\
\hline
Mistral 7B \cite{jiang2023mistral} & 7B & High-quality general performance & Medium & Balanced but heavier than 3B models \\
\hline
GPT-4 class models & -- & State-of-the-art performance & Not local & API-based only \\
\hline
\end{tabular}
\end{table}

\subsection{Selection of Adopted Methods}

Cognify adopts a local-first AI architecture via Ollama \cite{ollama} for privacy, reduced cost, and offline capability.
Semantic retrieval uses \textit{nomic-embed-text} (768-dimensional, pgvector-compatible) for its strong local retrieval quality.
Content generation uses \textit{Qwen2.5:3B} \cite{yang2024qwen2} for its balance of structured reasoning, inference speed, and local feasibility.
GPU acceleration is the primary inference strategy; CPU fallback ensures hardware compatibility.

\section{AI Model Integration}

This section describes content preparation for retrieval, LLM generation configuration, and output quality enforcement.

\subsection{Sources and Document Preprocessing}

Cognify accepts PDFs, scanned images, and pasted text. PDFs are parsed; images are processed via OCR \cite{smith2007overview}. Extracted text is chunked with overlap using \textit{tiktoken}, embedded via \textit{nomic-embed-text} into 768-dimensional vectors, and stored in PostgreSQL via \textit{pgvector} \cite{manning2008introduction}.
Key concepts are extracted into a subject-level taxonomy (core, supporting, minor) to ground generation prompts and guide adaptive targeting \cite{lewis2020rag}.


%------------------------------------------------

\subsection{Model Configuration}

All generation tasks share a common Ollama inference configuration. LLM outputs are validated against Pydantic schemas (\texttt{QuizOutput}, \texttt{FlashcardsOutput}, \texttt{ExamOutput}); failures trigger a targeted repair loop. High-determinism operations apply a reduced sampling temperature. Structured prompting, schema constraints, and repair are applied uniformly across all workflows.
%------------------------------------------------

\subsection{Experimental Evaluation}

Five test cases were evaluated manually across ingestion, quiz, summary, flashcard, and mock exam generation, rated on factual accuracy, structural quality, and pedagogical relevance (scale 1–5), with end-to-end latency measured from request to output delivery.

\begin{longtable}{|p{4.5cm}|p{4.2cm}|p{3cm}|p{3cm}|}
\hline
\rowcolor{gray!15}
\textbf{Test Case} & \textbf{Pipeline / AI Strategy} & \textbf{Relevance (1--5)} & \textbf{Latency (s)} \\
\hline
\endfirsthead

\hline
\rowcolor{gray!15}
\textbf{Test Case} & \textbf{Pipeline / AI Strategy} & \textbf{Relevance (1--5)} & \textbf{Latency (s)} \\
\hline
\endhead

Ingestion Pipeline (PDF/Text) & Chunking + Embedding + pgvector (RAG preprocessing) & 4 & 3.10 \\
\hline

Quiz Generation (10Q, intermediate) & RAG + LLM (Qwen2.5:3B) & 5 & 46.16 \\
\hline

Summary Generation (concise mode) & RAG + LLM (MAP/REDUCE summarization) & 5 & 12.34 \\
\hline

Flashcards Generation (10 cards) & RAG + LLM structured generation & 4 & 10.75 \\
\hline

Mock Exam Generation (10Q, static) & RAG + LLM multi-type generation + server-side grading (Qwen2.5:3B) & 4 & 54.30 \\
\hline

\rowcolor{gray!10}
\textbf{Average} & -- & \textbf{4.4 / 5} & \textbf{25.33} \\
\hline

\end{longtable}
\section{Sprint 3 Realization}

This section presents the Sprint 3 pipeline implementation: asynchronous processing, orchestration, storage architecture, and generation interfaces.

\subsection{System-Level Architecture Overview}

The pipeline transforms uploaded academic content through sequential stages: ingestion, preprocessing, semantic embedding, RAG, adaptive refinement, and output delivery. Processing is delegated to the Celery task queue upon upload; execution events are streamed to the client for real-time progress visibility.
Figure~\ref{fig:sprint3_pipeline} illustrates the high-level architecture and component interaction flow.
\begin{figure}[H]
    \centering
    \includegraphics[width=0.95\textwidth]{diags/sprint3/pipeline.png}
    \caption{High-Level Architecture of the Cognify Sprint 3 Pipeline}
    \label{fig:sprint3_pipeline}
\end{figure}

\subsection{Asynchronous Processing and Orchestration}

Computationally intensive tasks are dispatched to Celery workers via Redis; the Node.js backend returns a job identifier immediately. Workers execute independently, ensuring non-blocking request handling and horizontal scalability. Task failures are isolated at the job level; intermediate results are persisted to PostgreSQL before each stage. Structured progress events keep long-running operations fully observable throughout their lifecycle.


\subsection{Storage and Persistence Architecture}

The platform uses a three-layer storage model: PostgreSQL, Redis, and Google Drive. PostgreSQL stores all structured data and hosts chunk embeddings via \textit{pgvector}, enabling cosine similarity retrieval without a dedicated vector database. Redis manages ephemeral state — session data, Celery job progress, and adaptive signals — with sub-millisecond access. Uploaded files are stored in Google Drive and referenced in PostgreSQL via persistent Drive file identifiers.

%------------------------------------------------
\subsection{Generation Interfaces and Learning Outputs}

This subsection presents the interfaces for academic content upload, generation configuration, and learning material visualization.

\subsubsection{Upload Interface}

Figure~\ref{fig:upload-interface} illustrates the interface for uploading academic documents or providing text content prior to AI processing.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=0.7\textwidth,
        keepaspectratio
    ]{interfaces/sprint3/upload.png}
    \caption{Academic Content Upload Interface}
    \label{fig:upload-interface}
\end{figure}

\subsubsection{Generation Form}

Figure~\ref{fig:generation-form} illustrates the unified generation form used to configure AI-generated materials. Students select the generation type, difficulty level, number of items, and additional options appropriate to the selected output type.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=0.7\textwidth,
        keepaspectratio
    ]{interfaces/sprint3/generate_quiz.png}
    \caption{Unified AI Generation Form}
    \label{fig:generation-form}
\end{figure}

\subsubsection{Quiz Interface}

Figure~\ref{fig:quiz-interface} presents the quiz interface displayed after generation.

\begin{figure}[H]
    \centering

    \begin{subfigure}{0.48\textwidth}
        \centering
        \includegraphics[width=\textwidth, keepaspectratio]{interfaces/sprint3/quiz1.png}
        \caption{Quiz Interface 1}
        \label{fig:quiz1}
    \end{subfigure}
    \hfill
    \begin{subfigure}{0.48\textwidth}
        \centering
        \includegraphics[width=\textwidth, keepaspectratio]{interfaces/sprint3/quiz2.png}
        \caption{Quiz Interface 2}
        \label{fig:quiz2}
    \end{subfigure}

    \caption{Generated Quiz Interfaces}
    \label{fig:quiz-interface}
\end{figure}
\subsubsection{Summary Interface}

Figure~\ref{fig:summary-interface} illustrates the generated summary interface.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=0.7\textwidth,
        keepaspectratio
    ]{interfaces/sprint3/summary.png}
    \caption{Generated Summary Interface}
    \label{fig:summary-interface}
\end{figure}

\subsubsection{Flashcard Interface}

Figure~\ref{fig:flashcard-interface} presents the generated flashcard interfaces.

\begin{figure}[H]
    \centering

    \begin{subfigure}[t]{0.48\textwidth}
        \centering
        \includegraphics[
            width=\textwidth,
            keepaspectratio
        ]{interfaces/sprint3/flashcard1.png}
        \caption{Flashcard Overview}
    \end{subfigure}
    \hfill
    \begin{subfigure}[t]{0.48\textwidth}
        \centering
        \includegraphics[
            width=\textwidth,
            keepaspectratio
        ]{interfaces/sprint3/flashcard2.png}
        \caption{Flashcard Interaction}
    \end{subfigure}

    \caption{Generated Flashcard Interfaces}
    \label{fig:flashcard-interface}
\end{figure}
\subsubsection{Mock Exam Interface}

Figure~\ref{fig:exam-interface} illustrates the mock exam interface and the post-submission grading result view.

\begin{figure}[H]
    \centering

    \begin{subfigure}[t]{0.48\textwidth}
        \centering
        \includegraphics[
            width=\textwidth,
            keepaspectratio
        ]{interfaces/sprint3/exam1.png}
        \caption{Mock Exam Interface}
    \end{subfigure}
    \hfill
    \begin{subfigure}[t]{0.48\textwidth}
        \centering
        \includegraphics[
            width=\textwidth,
            keepaspectratio
        ]{interfaces/sprint3/exam2.png}
        \caption{Exam Result and Grading}
    \end{subfigure}

    \caption{Generated Mock Exam Interfaces}
    \label{fig:exam-interface}
\end{figure}

\section{Conclusion}

Sprint 3 established the end-to-end pipeline transforming raw academic content into structured learning artifacts through sequential stages: ingestion, chunk embedding, concept taxonomy construction, RAG-grounded generation, and adaptive grading.
The architecture separates concerns across ingestion, retrieval, generation, and learner modeling layers, enabling output personalization calibrated to each student's proficiency profile.