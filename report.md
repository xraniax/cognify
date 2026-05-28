\chapter*{Chapter 1}
\markboth{Chapter 1}{Project Context}
\addcontentsline{toc}{chapter}{1 Project Context}

\begin{center}
\textsc{\Huge\textbf{Project Context}}
\end{center}

\setcounter{chapter}{1}

%------------------------------------------------
\section{Introduction}

This chapter introduces the general context of the project by first presenting the host organization and its technological environment. It then explores the current landscape of intelligent learning platforms through a comparative study of existing solutions in order to identify their strengths and limitations.

Finally, the chapter presents Cognify as the proposed solution and explains how its architecture and AI-assisted features address the identified challenges. The chapter concludes with an overview of the development methodology adopted to guide the implementation process throughout the project lifecycle.

%------------------------------------------------
\section{Presentation of the Host Organization}

Understanding the professional context of the project requires a clear description of the host organization. This section introduces its background, mission, and technological focus, setting the stage for the relevance of Cognify within the company’s strategic vision.

\subsection{Kernel Solutions and Innovation}

Kernel Solutions and Innovation (KSI)\cite{ksiwebsite} is a technology-oriented company specialized in the design and development of innovative digital solutions adapted to real-world challenges. The company focuses on delivering reliable, scalable, and user-centered systems by combining modern software engineering practices with emerging technologies.Figure~\ref{fig:ksi_logo} illustrates the official logo of Kernel Solutions and Innovation.



\begin{figure}[H]
\centering
\includegraphics[width=2cm]{logos/ksi.jpg}
\caption{Kernel Solutions and Innovation logo}
\label{fig:ksi_logo}
\end{figure}

\subsection{Fields of Activity}

KSI operates in several areas related to software engineering and digital innovation :

\begin{itemize}
\item \textbf{Software and Application Development} – KSI develops custom web and mobile applications. Their solutions are designed to help organizations digitalize their services, optimize workflows, and provide modern and accessible digital platforms.
\item \textbf{Educational Technology Solutions} – The company is also active in the field of educational technologies. These solutions facilitate course management, learner follow-up, and interaction between students, teachers, and administrators.
\item \textbf{Digital Marketing and SEO} – In addition to development services, KSI provides digital marketing and SEO solutions aimed at improving online visibility, strengthening digital presence, and increasing audience engagement.
\end{itemize}
%------------------------------------------------
\section{Study of Existing Solutions}

In order to better position the proposed solution, this section presents a study of several representative platforms currently used in the educational technology landscape. The objective of this analysis is to identify their main functionalities, strengths, and limitations, while highlighting the gaps that motivated the development of Cognify.

%================================================

Figure~\ref{fig:competitor-interfaces} presents a compact visual comparison of the interfaces of the studied platforms.
\vspace{0.3cm}

\begin{figure}[H]
\centering

% Row 1
\begin{minipage}{0.48\textwidth}
    \centering
    \includegraphics[width=\textwidth,height=5cm,keepaspectratio]{images/interfaces/notebooklm_interface.png}
    \caption*{(a) NotebookLM}
\end{minipage}
\hfill
\begin{minipage}{0.48\textwidth}
    \centering
    \includegraphics[width=\textwidth,height=5cm,keepaspectratio]{images/interfaces/revisely_interface.png}
    \caption*{(b) Revisely}
\end{minipage}

\vspace{0.5cm}

% Row 2
\begin{minipage}{0.48\textwidth}
    \centering
    \includegraphics[width=\textwidth,height=5cm,keepaspectratio]{images/interfaces/quizlet.png}
    \caption*{(c) Quizlet}
\end{minipage}
\hfill
\begin{minipage}{0.48\textwidth}
    \centering
    \includegraphics[width=\textwidth,height=5cm,keepaspectratio]{images/interfaces/khacademy.png}
    \caption*{(d) Khan Academy}
\end{minipage}

\caption{Interface overview of existing educational platforms}
\label{fig:competitor-interfaces}

\end{figure}
\subsection{NotebookLM Overview}

NotebookLM, developed by Google, is an AI-powered research and note-assistance platform designed to help users interact intelligently with their documents. The platform allows students and researchers to upload educational resources such as lecture notes, PDFs, and research papers, then explore them through conversational AI interactions. \cite{notebooklm}

Its main strength lies in contextual understanding, as the system generates answers and explanations directly based on the uploaded content (Table~\ref{tab:notebooklm_strengths_limitations}).

%\begin{figure}[H]
%\centering
%\includegraphics[width=12cm]{images/interfaces/notebooklm_interface.png}
%\caption{NotebookLM interface}
%\end{figure}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.5}
\caption{NotebookLM: Strengths and Limitations}
\label{tab:notebooklm_strengths_limitations}
\begin{tabular}{M{4cm} M{6cm} M{6cm}}
\toprule
\textbf{Platform} & \textbf{Strengths} & \textbf{Limitations} \\
\midrule
\includegraphics[width=3cm]{logos/NotebookLM.jpg} &
• Interactive question-answering based on uploaded documents \newline
• Automatic summarization of academic content \newline
• Context-aware explanations \newline
• AI-generated study guides &
• Limited analytics for performance tracking \newline
• No adaptive learning paths \newline
• Primarily research-oriented \newline
• Does not provide a complete learning ecosystem \\
\bottomrule
\end{tabular}
\end{table}

%================================================
\subsection{Revisely Overview}

Revisely is an AI-assisted revision platform focused on helping students prepare for examinations through automated study material generation. The platform provides features such as summary generation, flashcard creation, and quiz generation to simplify revision workflows. \cite{revisely}

Its simplicity and automation capabilities make it effective for short-term exam preparation (Table~\ref{tab:revisely-strength}).

%\begin{figure}[H]
%\centering
%\includegraphics[width=10cm]{images/interfaces/revisely_interface.png}
%\caption{Revisely interface}
%\end{figure}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.5}
\caption{Revisely: Strengths and Limitations}
\label{tab:revisely-strength}
\begin{tabular}{M{4cm} M{6cm} M{6cm}}
\toprule
\textbf{Platform} & \textbf{Strengths} & \textbf{Limitations} \\
\midrule
\includegraphics[width=3cm]{logos/revisely.png} &
• Quick quiz and exercise generation \newline
• Automatic flashcard creation \newline
• Simplified revision workflow \newline
• AI-assisted study support &
• Advanced functionalities require paid access \newline
• Limited adaptive learning features \newline
• Lack of detailed analytics \newline
• Less suitable for long-term structured learning \\
\bottomrule
\end{tabular}
\end{table}

%================================================
\subsection{Quizlet Overview}

Quizlet is a widely used educational platform centered around flashcard-based learning and interactive revision activities. It allows students to create, share, and study custom learning sets while benefiting from gamified learning experiences. \cite{quizlet}

The platform emphasizes collaborative and engaging learning through adaptive practice sessions and interactive study modes (Table~\ref{tab:quizlet_strengths_limitations}).

%\begin{figure}[H]
%\centering
%\includegraphics[width=10cm]{images/interfaces/quizlet.png}
%\caption{Quizlet interface}
%\end{figure}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.5}
\caption{Quizlet: Strengths and Limitations}
\label{tab:quizlet_strengths_limitations}
\begin{tabular}{M{4cm} M{6cm} M{6cm}}
\toprule
\textbf{Platform} & \textbf{Strengths} & \textbf{Limitations} \\
\midrule
\includegraphics[width=2.5cm]{logos/quizlet-logo.png} &

• Gamified learning activities \newline
• Adaptive practice sessions \newline
• Accessible flashcard-based revision & 
• Limited AI-assisted analysis  \newline
• No integrated intelligent tutoring \newline
• Minimal advanced performance analytics \\
\bottomrule
\end{tabular}
\end{table}

%================================================
\subsection{Khan Academy Overview}

Khan Academy is a globally recognized educational platform offering free courses, instructional videos, and exercises across a broad range of subjects. The platform is known for its structured educational approach and accessibility. \cite{khanacademy} 

Its learning model is mainly based on predefined courses and guided progression through exercises and video lessons (Table~\ref{tab:khan_strengths_limitations})


%\begin{figure}[H]
%\centering
%\includegraphics[width=10cm]{images/interfaces/khacademy.png}
%\caption{Khan Academy interface}
%\end{figure}

\begin{table}[H]
\centering
\renewcommand{\arraystretch}{1.5}
\caption{Khan Academy: Strengths and Limitations}
\label{tab:khan_strengths_limitations}
\begin{tabular}{M{4cm} M{6cm} M{6cm}}
\toprule
\textbf{Platform} & \textbf{Strengths} & \textbf{Limitations} \\
\midrule
\includegraphics[width=3cm]{logos/khan.jpg} &
• High-quality structured educational content \newline
• Free accessibility \newline
• Exercise-based progress tracking \newline
• Strong international reputation &
• Limited personalization \newline
• No AI-based content analysis \newline
• Rigid learning structure \newline
• Limited intelligent tutoring capabilities \\
\bottomrule
\end{tabular}
\end{table}

%------------------------------------------------
\subsection{Comparative Analysis}

Although each platform offers valuable functionalities within its own scope, none fully combines AI-powered content generation, adaptive tutoring, and analytics (Table~\ref{tab:comparison}).

\begin{table}[H]
\centering
\caption{Feature Comparison of Intelligent Learning Platforms}
\label{tab:comparison}
\renewcommand{\arraystretch}{1.5}
\begin{tabular}{lcccc}
\toprule
\textbf{Feature} & \textbf{NotebookLM} & \textbf{Revisely} & \textbf{Quizlet} & \textbf{Khan Academy} \\
\midrule
AI content generation & \cmark & \cmark & \xmark & \xmark \\
Document-based learning & \cmark & \cmark & \xmark & \xmark \\
Adaptive learning paths & \xmark & \xmark & \cmark & \xmark \\
Performance analytics & \xmark & \xmark & \cmark & \cmark \\
Free accessibility & \cmark & \xmark & \cmark & \cmark \\
Interactive tutoring & \cmark & \xmark & \cmark & \xmark \\
\bottomrule
\end{tabular}
\end{table}

%------------------------------------------------
\section{Critique of Existing Solutions}

The study of existing platforms reveals several limitations that continue to affect the overall learning experience.

\begin{itemize}

\item \textbf{Fragmented functionalities:}  
Most solutions focus on isolated learning tasks such as flashcard generation, course delivery, or document interaction, forcing students to switch between multiple platforms during their study sessions.

\item \textbf{Limited personalization:}  
Few platforms provide truly adaptive learning experiences based on the learner’s uploaded content, progress, and study behavior.

\item \textbf{Insufficient analytics:}  
Detailed performance monitoring and actionable learning insights remain limited in most existing systems.

\item \textbf{High manual effort:}  
Students are still frequently required to organize resources and prepare study materials manually.

\item \textbf{Lack of integrated intelligent assistance:}  
Several platforms provide static educational content without offering contextual tutoring or interactive AI guidance tailored to the learner’s needs.

\end{itemize}


%------------------------------------------------
\section{Proposed Solution}

The previous observations highlight the need for a more integrated and intelligent learning environment capable of centralizing educational resources while providing adaptive support and personalized learning assistance.
As a solution we propose \textbf{Cognify}, an intelligent educational platform designed to support students throughout their entire learning process.


\subsection{General Presentation of Cognify}

Cognify combines artificial intelligence, educational content management, and learning analytics within a unified ecosystem intended to simplify revision workflows and improve learning efficiency. Rather than functioning solely as a document repository or exercise generator, the platform aims to create an interactive environment where students can organize materials, generate personalized study resources, and receive contextual academic assistance from a single workspace.

By integrating AI-powered functionalities directly into the learning workflow, Cognify seeks an engaging educational experience the adapts to the student's learning patterns.
To achieve this objective, the platform is organized around a centralized and modular learning workspace that integrates educational resources, AI services, and study management tools within a unified environment.

%------------------------------------------------
\subsection{Centralized Modular Workspace}

One of the key strengths of Cognify lies in its centralized modular workspace, designed to simplify the management of educational resources and study activities.

Students can upload and organize various learning materials, including PDFs, lecture notes, and textual content, within dedicated subject workspaces. This unified structure reduces fragmentation and allows learners to manage all their educational resources from a single interface.

The workspace architecture is organized into three main areas:

\begin{itemize}

\item \textbf{Left Sidebar:}  
Provides access to uploaded resources, generated materials, and workspace navigation tools.

\item \textbf{Central Workspace:}  
Serves as the primary interaction area where students can explore summaries, quizzes, flashcards, and mock exams generated from their study materials.

\item \textbf{AI Tutor Panel:}  
Acts as an intelligent assistant capable of answering questions and generating explanations based on the uploaded educational content.

\end{itemize}

This modular organization creates a structured and intuitive learning environment that encourages efficient study management.
Beyond resource centralization, the platform leverages artificial intelligence to transform uploaded educational content into interactive and adaptive learning experiences.

%------------------------------------------------
\subsection{AI-Powered Study Intelligence}

Artificial intelligence represents the core component of the Cognify platform, as AI technologies are increasingly being integrated into educational systems to support personalized and adaptive learning experiences \cite{holmes2019ai,zawacki2019systematic}. After analyzing uploaded educational resources, the system can generate interactive study materials intended to support active learning and revision.

Its main capabilities include:

\begin{itemize}

\item \textbf{Content Summarization:}  
Transforms large volumes of educational content into concise and structured summaries.

\item \textbf{Flashcards and Quizzes:}  
Automatically generates revision exercises that encourage active recall and self-assessment.

\item \textbf{Mock Exams:}  
Provides simulated examination environments to help students evaluate their preparation level.

\item \textbf{Contextual AI Tutoring:}  
Allows learners to ask questions and receive explanations generated directly from their uploaded materials.

\end{itemize}

Through these features, Cognify transforms traditional studying into a more interactive, personalized, and efficient experience.
In addition to generating educational content and assistance services, the platform also analyzes learner interactions in order to provide continuous insight into study behavior and performance progression.
%------------------------------------------------
\subsection{Advanced Learning Analytics}

In addition to AI-assisted content generation, Cognify integrates analytics features that help students better understand their learning progression and study behavior.

The platform continuously monitors user interactions and generated material usage in order to provide meaningful performance indicators and personalized feedback.

These analytics capabilities include:

\begin{itemize}

\item \textbf{Progress Tracking:}  
Monitoring study consistency, completed activities, and engagement levels.

\item \textbf{Performance Insights:}  
Identifying strengths, weaknesses, and areas requiring additional attention.

\item \textbf{Personalized Recommendations:}  
Providing suggestions intended to optimize revision strategies and improve learning efficiency.

\end{itemize}
Given the intelligent, modular, and progressively evolving nature of the platform, an adaptive development methodology was required to support iterative feature integration and continuous refinement throughout the project lifecycle.

\section{Project Methodology}

The system required continuous experimentation, incremental validation, and progressive refinement, particularly for the processing pipeline, orchestration layer, and AI-based features.

To address these constraints, an Agile approach based on the Scrum framework was adopted. Scrum is an Agile framework for managing complex product development through iterative and incremental delivery, emphasizing collaboration, adaptability, and continuous improvement \cite{scrum_guide}. It provides an iterative development process organized into short cycles (Sprints), enabling continuous delivery of functional increments and frequent validation of system evolution \cite{scrum_guide}.

Each Sprint was dedicated to a coherent set of objectives, progressively covering core platform functionalities. This incremental approach allowed regular feedback integration and ensured alignment between implementation and requirements throughout the project lifecycle.

The Scrum roles were defined as follows:
\begin{itemize}
\item \textbf{Product Owner:} defines requirements, prioritizes the Product Backlog, and validates delivered increments.
\item \textbf{Scrum Master:} ensures proper application of Scrum practices and facilitates team coordination.
\item \textbf{Development Team:} handles design, implementation, testing, and integration of system components.
\end{itemize}

Figure \ref{fig:scrum-framework} illustrates the Scrum workflow adopted in this project.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=0.7\textwidth,
        keepaspectratio
    ]{images/The_scrum_framework.png}
    \caption{Scrum Development Framework}
    \label{fig:scrum-framework}
\end{figure}
\section{Conclusion}

Cognify project context was established in this first chapter by introducing our parent company, integrating our solution into the current marketplace. The groundwork has been established within this first chapter for detailing Cognify's design, implementation, and evaluation in subsequent chapters.
\chapter*{chapter 2}

\markboth{Chapter 2 }{ Requirements Specification} %pour afficher l'entete
\addcontentsline{toc}{chapter}{2 Requirements Specification}
\textbf{\Huge Requirements Specification} 

\setcounter{chapter}{2}
\setcounter{section}{0}


\section{Introduction}

This section outlines everything required for building the Cognify platform. This will include all the various aspects of Cognify – including functional, non-functional, and technical – to be used as guidance for designing and implementing it to ensure Cognify truly supports students in their learning journey.

\section{Functional Requirements}
%question
Cognify provides important support for students through its functional requirements that include:

\begin{itemize}
\item Content Management: Students will be able to upload, organize, and access their study materials, which includes documents, notes, and PDFs in all formats.
\item AI-Assisted Learning: The platform will have the ability to create summaries, exercises, and practice questions based on the uploaded content.
\item Personal Learning Paths: Cognify will record and track the student's progress and create exercise recommendations based on the progress of the student and the pace at which they are learning.
\item Progress Tracking: Students will have the ability to view their dashboards to see their history of learning and completed exercises and where they need to focus.
\item User Interaction: The student will receive context-specific help from an AI assistant as part of their experience while using the platform.
\end{itemize}

\section{Non-Functional Requirements}

The Cognify platform is designed to provide a reliable, efficient, and secure learning environment capable of supporting AI-driven educational services. The following non-functional requirements define the quality attributes of the system:

\begin{itemize}
\item \textbf{Performance:} Document processing, content generation, and AI-based interactions must be executed within acceptable response times to ensure a smooth learning experience for students.

\item \textbf{Reliability:} The platform must ensure stable operation with minimal interruptions, particularly for core services such as content access, AI tutoring, and study material generation.

\item \textbf{Scalability:} Cognify must support an increasing number of users and educational resources while maintaining consistent performance across document uploads, processing pipelines, and learning activities.

\item \textbf{Security:} User data and educational content must be protected against unauthorized access through secure authentication mechanisms and controlled access based on user roles.

\item \textbf{Usability:} The user interface must provide an intuitive and accessible experience, allowing students to easily upload materials, navigate study resources, and interact with AI-powered features.
\end{itemize}

These requirements ensure that the platform remains robust, responsive, and suitable for continuous use in an academic learning environment.
\section{Actors Identification} 

An actor represents an entity that interacts with the platform by assuming a specific role. In the context of our project, the following actors have been identified :

Figure \ref{fig:system-actors} illustrates the different actors interacting with the platform.

\begin{figure}[H]
    \centering
    \includegraphics[width=0.3\textwidth]{diags/actors.png}
    \caption{Actors of the Cognify Platform}
    \label{fig:system-actors}
\end{figure}

\begin{itemize}
\item Students: The central users who upload content, practice exercises, and monitor their progress.
\item Administrators: Responsible for system configuration, user management, and monitoring overall platform performance.
\item AI System: A non-physical actor responsible for generating intelligent educational assistance, processing student questions, and producing contextual responses.
\end{itemize}



%-----------------------------%
\section{Technical Requirements}

This section presents the development environment of the Cognify platform and justifies the selection of technologies used across the system. The chosen stack was guided by requirements related to scalability, maintainability, AI integration, and development efficiency.

\subsection{Development Environment}

The development process relied on a set of tools that ensured efficient collaboration, reproducibility, and structured software engineering practices throughout the project lifecycle.

%========================
\begin{tcolorbox}[colback=gray!3, colframe=black!30, arc=2mm, boxrule=0.5pt, title=\textbf{Version Control System}]
\begin{minipage}{0.18\textwidth}
    \centering
    \includegraphics[width=2cm]{logos/git.png}
\end{minipage}
\hfill
\begin{minipage}{0.78\textwidth}
\textbf{Git} is used to manage source code evolution through distributed version control, enabling branching, merging, and full history tracking across the project.

\textbf{GitHub} is used as the collaboration platform for repository hosting, pull requests, and issue tracking, ensuring structured team coordination and version control workflows \cite{github_actions_docs, git_official}.
\end{minipage}
\end{tcolorbox}

%========================
\begin{tcolorbox}[colback=gray!5, colframe=black!30, arc=2mm, boxrule=0.5pt, title=\textbf{Containerization}]
\begin{minipage}{0.18\textwidth}
    \centering
    \includegraphics[width=2cm]{logos/docker.jpg}
\end{minipage}
\hfill
\begin{minipage}{0.78\textwidth}
\textbf{Docker} is used to containerize the different services of Cognify, ensuring consistent execution environments across development, testing, and deployment stages \cite{docker_docs}.
\end{minipage}
\end{tcolorbox}
\begin{tcolorbox}[colback=gray!5, colframe=black!30, arc=2mm, boxrule=0.5pt, title=\textbf{Code Editor \& Development Tool}]
\begin{minipage}{0.18\textwidth}
    \centering
    \includegraphics[width=2cm]{logos/antigravity.png}
\end{minipage}
\hfill
\begin{minipage}{0.78\textwidth}
\textbf{Antigravity} is used as a code editor for writing and managing the project source code. It provides contextual suggestions that assist during development and debugging \cite{antigravity_ide_docs}.
\end{minipage}
\end{tcolorbox}
%========================
\begin{tcolorbox}[colback=gray!3, colframe=black!30, arc=2mm, boxrule=0.5pt, title=\textbf{API Development \& Testing}]
\begin{minipage}{0.18\textwidth}
    \centering
    \includegraphics[width=2cm]{logos/postman.png}
\end{minipage}
\hfill
\begin{minipage}{0.78\textwidth}
\textbf{Postman} is used to design, test, and validate REST APIs during backend development, ensuring correct communication between system components \cite{postman_docs}.
\end{minipage}
\end{tcolorbox}

%========================
\begin{tcolorbox}[colback=gray!5, colframe=black!30, arc=2mm, boxrule=0.5pt, title=\textbf{Documentation \& Project Management}]
\begin{minipage}{0.18\textwidth}
    \centering
    \includegraphics[width=2cm]{logos/notion.png}
\end{minipage}
\hfill
\begin{minipage}{0.78\textwidth}
\textbf{Notion} is used as a collaborative workspace for documenting system design, tracking tasks, and organizing project requirements throughout development \cite{notion_docs}.
\end{minipage}
\end{tcolorbox}

%========================
\begin{tcolorbox}[colback=gray!3, colframe=black!30, arc=2mm, boxrule=0.5pt, title=\textbf{Design \& Modeling Tools}]
\begin{minipage}{0.18\textwidth}
    \centering
    \includegraphics[width=2cm]{logos/lucid.jpeg}
\end{minipage}
\hfill
\begin{minipage}{0.78\textwidth}
\textbf{Lucidchart} is used for system modeling, UML diagrams, and architecture design, supporting clear visualization of system workflows and components \cite{lucidchart_docs}.
\end{minipage}
\end{tcolorbox}

%========================
\subsection{Software Environment}

The software environment was designed to support a hybrid architecture combining web technologies, AI-driven services, and scalable data processing components.

%========================
\begin{tcolorbox}[colback=gray!3, colframe=black!30, arc=2mm, boxrule=0.4pt, title=\textbf{Frontend Layer}]
\begin{minipage}{0.18\textwidth}
    \centering
    \includegraphics[width=2cm]{logos/react.png}
\end{minipage}
\hfill
\begin{minipage}{0.78\textwidth}
\textbf{React 19} is used to build the user interface of Cognify using a component-based architecture, enabling efficient rendering of dynamic dashboards, AI chat interfaces, and interactive learning components \cite{react_docs}.
\end{minipage}
\end{tcolorbox}

%========================
\begin{tcolorbox}[colback=gray!5, colframe=black!30, arc=2mm, boxrule=0.4pt, title=\textbf{Backend Layer}]
\begin{minipage}{0.18\textwidth}
    \centering
    \includegraphics[width=2cm]{logos/nodejs.png}
\end{minipage}
\hfill
\begin{minipage}{0.78\textwidth}
\textbf{Node.js + Express} is used as the main backend layer responsible for API routing, authentication, and orchestration between frontend and AI services \cite{node_docs, express_docs}.
\end{minipage}
\end{tcolorbox}

%========================
\begin{tcolorbox}[colback=gray!3, colframe=black!30, arc=2mm, boxrule=0.4pt, title=\textbf{AI Engine}]
\begin{minipage}{0.18\textwidth}
    \centering
    \includegraphics[width=2cm]{logos/python.png}
\end{minipage}
\hfill
\begin{minipage}{0.78\textwidth}
\textbf{Python 3.11+} is used as the core engine for AI-driven functionalities such as content generation, retrieval-based workflows, and evaluation logic due to its strong machine learning ecosystem \cite{python_docs}.
\end{minipage}
\end{tcolorbox}

%========================
\begin{tcolorbox}[colback=gray!3, colframe=black!30, arc=2mm, boxrule=0.4pt, title=\textbf{Database Layer}]
\begin{minipage}{0.18\textwidth}
    \centering
    \includegraphics[width=2cm]{logos/postgresql.png}
\end{minipage}
\hfill
\begin{minipage}{0.78\textwidth}
\textbf{PostgreSQL 16} is used as the primary relational database for structured data storage. The \textbf{pgvector} extension enables efficient similarity search over embeddings, which is essential for AI-powered retrieval and tutoring features \cite{postgres_docs, pgvector_docs}.
\end{minipage}
\end{tcolorbox}
\newpage
\section{Global Use Case Diagram} 
 This section presents the overall structure of the Cognify platform, highlighting the interactions between users, system components, and external services.  Figure~\ref{fig:global-usecase} illustrates this behavior.
 \vspace{0.5cm} 
 \begin{figure}[H] 
 \centering 
 \includegraphics[width=14cm, height=20cm]{diags/usecase.png} 
 \caption{global use case diagram} 
 \label{fig:global-usecase}
 \label{3} 
 \end{figure}
 \newpage 
 \section{Product Backlog} Table \ref{tab:product_backlog} presents the updated product backlog for Cognify. The backlog reflects the functionalities identified in the global use case diagram and organizes them according to priority and sprint planning. 
 \begin{table}[H] 
\centering 
\caption{Product Backlog}
\label{tab:product_backlog}

\renewcommand{\arraystretch}{1.25}
\setlength{\tabcolsep}{6pt}

\begin{tabularx}{\textwidth}{|>{\raggedright\arraybackslash}X|c|c|}

\hline
\rowcolor{gray!15}
\textbf{User Story} & \textbf{Priority} & \textbf{Sprint} \\
\hline

As a Student, I can create an account. & 1 & S1 \\
\hline

As a Student/Admin, I can log into the platform securely. (Gmail/GitHub login, forgot password) & 1 & S1 \\
\hline

As a Student, I can view and edit my profile information. & 1 & S1 \\
\hline

As an Admin, I can manage users (delete or suspend user, edit permissions, edit storage quota). & 1 & S1 \\
\hline

As an Admin, I can configure platform settings. & 2 & S1 \\
\hline

As a Student, I can define and manage my study goals. & 1 & S2 \\
\hline

As a Student, I can create and manage subjects. & 1 & S2 \\
\hline

As a Student, I can access a subject workspace (manage uploads, manage materials, view details, edit, delete). & 1 & S2 \\
\hline

As a Student, I can manage uploads. & 1 & S2 \\
\hline

As a Student, I can manage generated materials (view, edit, delete, rate, export PDF). & 1 & S2 \\
\hline

As a Student, I can access the trash (restore material, delete material, empty trash, edit retention period). & 2 & S2 \\
\hline

As an Admin, I can manage files (filter, search, sort, download, delete). & 2 & S2 \\
\hline

As a Student, I can generate quizzes from my study materials. & 2 & S3 \\
\hline

As a Student, I can generate mock exams from my study content. & 2 & S3 \\
\hline

As a Student, I can generate flashcards automatically. & 2 & S3 \\
\hline

As a Student, I can generate summaries of my study materials. & 2 & S3 \\
\hline

As a Student, I can interact with an AI tutor. & 2 & S4 \\
\hline

As a Student, I can view my learning performance and analytics. & 2 & S4 \\
\hline

As an Admin, I can monitor system analytics. & 2 & S4 \\
\hline

As an Admin, I can view system notifications. & 3 & S4 \\
\hline

\end{tabularx}

\end{table}
\newpage
\section{Sprint Planning}

The sprint planning was organized by grouping the functional requirements into coherent iterations, ensuring a progressive and structured development approach, as illustrated in Table~\ref{tab:sprint_planning}.

\begin{table}[H]
\centering
\caption{Sprint Planning}
\label{tab:sprint_planning}

\renewcommand{\arraystretch}{1.25}
\setlength{\tabcolsep}{6pt}

\begin{tabular}{|c|p{4cm}|p{9cm}|}

\hline
\rowcolor{gray!15}
\textbf{Sprint} & \textbf{Objective} & \textbf{Functionalities} \\
\hline

Sprint 1 & User Management and Authentication &
-- Sign in \newline
-- Sign up \newline
-- Manage users \newline
-- View profile \newline
-- Edit platform configurations \\
\hline

Sprint 2 & Content and Workspace Management &
-- Manage subjects \newline
-- Access subject workspace \newline
-- Manage uploads \newline
-- Manage trash \newline
-- Manage study goals \newline
-- View files \\
\hline

Sprint 3 & Content Generation Features &
-- Upload files \newline
-- Generate quizzes \newline
-- Generate mock exams \newline
-- Generate summaries \newline
-- Generate flashcards \newline
-- Generate study plans \\
\hline

Sprint 4 & Analytics and System Interaction &
-- View performance \newline
-- View study sessions \newline
-- Manage study goals \newline
-- Interact with AI tutor \newline
-- View logs \newline
-- View notifications \newline
-- View platform activity \\
\hline

\end{tabular}

\end{table}
\section{Conclusion}
In this chapter, we have thoroughly analyzed the requirements for the Cognify platform, establishing a clear foundation for its design and implementation. This detailed specification sets the stage for the subsequent chapters, which will focus on the system’s architecture, design, and implementation.
\chapter{Sprint 1}
\label{chap:sprint1}
%-----------------------------------------------------------------

\section{Introduction}

This chapter presents Sprint 1, the first implementation phase of Cognify, focusing on the development of core authentication, user management, and platform configuration functionalities.

\section{Sprint Backlog}
Table~\ref{tab:sprint1_backlog} presents the Sprint 1 backlog of the Cognify platform and its prioritized user stories.
\vspace{0.3cm}

\renewcommand{\arraystretch}{1.35}
\setlength{\tabcolsep}{6pt}

\begin{longtable}{|>{\raggedright\arraybackslash}p{11.3cm}|>{\centering\arraybackslash}p{1.5cm}|>{\centering\arraybackslash}p{2.2cm}|}

\caption{Sprint 1  Backlog}
\label{tab:sprint1_backlog}\\

\hline
\rowcolor{gray!15}
\textbf{User Story} & \textbf{Priority}\\
\hline
\endfirsthead

\hline
\rowcolor{gray!15}
\textbf{User Story} & \textbf{Priority}\\
\hline
\endhead

As a Student, I can create an account using a form. & 1\\
\hline

As a user (Student or Admin), I can recover my account using a forgot password mechanism. & 1\\
\hline

As an Admin, I can view the list of all users details. & 1\\
\hline

As an Admin, I can edit user permissions and roles. & 1\\
\hline

As an Admin, I can manage user storage quotas. & 1\\
\hline

As an Admin, I can edit the default user storage quota. & 1\\
\hline

As an Admin, I can edit the platform capacity ceiling. & 1\\
\hline

As an Admin, I can edit the default maximum upload size. & 1\\
\hline

As an Admin, I can enable or disable public registration. & 1\\
\hline

As an Admin, I can suspend or reactivate user accounts. & 1\\
\hline

As an Admin, I can delete user accounts from the system. & 1\\
\hline

As a Student, I can sign in using email and password or third-party providers (Google, GitHub). & 2\\
\hline

As a Student, I can view and edit my personal profile info. & 3\\
\hline

\end{longtable}
%--------------------------------------%
\section{Sprint 1 Refinement}
The following section concerns the refinement of the use cases : 
\begin{itemize}
    \item Sign in,
    \item Sign up,
    \item Manage users,
    \item View profile,
    \item Edit platform configurations.
\end{itemize}

\subsection{Sprint 1 use case Diagram}

Figure \ref{fig:sprint1-global} below presents refinement of Sprint 1 use cases.

\begin{figure}[H]
    \centering
    \includegraphics[width=\textwidth]{diags/sprint1/global_usecase.png}
    \caption{Global Use Case Diagram for Sprint 1}
    \label{fig:sprint1-global}
\end{figure}

%------------------------------------------------

\subsection{Use Case Refinement: ``Sign Up''}

Table \ref{tab:uc-signup} illustrates the refinement of the "Sign Up" use case.

\renewcommand{\arraystretch}{1.25}
\setlength{\tabcolsep}{6pt}

\begin{longtable}{|>{\raggedright\arraybackslash}p{3.1cm}|>{\raggedright\arraybackslash}p{11cm}|}
\caption{Use Case Refinement — Sign Up}
\label{tab:uc-signup}\\

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

\textbf{Actor} & Student \\
\hline

\textbf{Pre-condition} & User accesses the platform; email service is operational. \\
\hline

\textbf{Post-condition} & Account is created and the Student is authenticated. \\
\hline

\textbf{Main Scenario} &
The system displays the \textit{Sign Up} page. The actor fills in the registration form and clicks \textit{Sign Up}. The system validates the information, sends a confirmation email, then redirects the actor to the \textit{Dashboard}. \\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, topsep=0pt, itemsep=1pt]
    \item Email address already associated with an existing account.
    \item Email address does not exist
    \item Submitted information is invalid or incomplete.
    \item Password does not satisfy security requirements.
    \item Email service temporarily unavailable.
\end{itemize}
\\
\hline

\end{longtable}

%------------------------------------------------

\subsection{Use Case Refinement: ``Sign In''}

Table \ref{tab:uc-signin} illustrates the refinement of the "Sign In" use case.

\renewcommand{\arraystretch}{1.25}

\begin{longtable}{|>{\raggedright\arraybackslash}p{3.1cm}|>{\raggedright\arraybackslash}p{11cm}|}
\caption{Use Case Refinement — Sign In}
\label{tab:uc-signin}\\

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

\textbf{Actor} & Student and Admin \\
\hline

\textbf{Pre-condition} & User owns a registered and activated account.\\
\hline

\textbf{Post-condition} & User accesses the platform and is redirected according to their role. \\
\hline

\textbf{Main Scenario} &
\begin{enumerate}[leftmargin=*, topsep=0pt, itemsep=1pt]
    \item The system displays the \textit{Sign In} page.
    \item User authenticates using:
    \begin{enumerate}[label=\alph*), topsep=0pt, itemsep=1pt]
        \item Google or GitHub authentication.
        \item Email and password authentication.
    \end{enumerate}
    \item The system validates the authentication request.
    \item User is redirected to:
    \begin{itemize}[leftmargin=*, topsep=0pt, itemsep=1pt]
        \item \textbf{Student} $\rightarrow$ \textit{Dashboard}
        \item \textbf{Admin} $\rightarrow$ \textit{Admin Console}
    \end{itemize}
\end{enumerate}
\\
\hline

\textbf{Forgot Password} &
\begin{enumerate}[leftmargin=*, topsep=0pt, itemsep=1pt]
    \item The actor clicks Forgot Password.
    \item The system requests the registered email.
    \item A reset link is sent to the actor.
    \item The actor defines a new password.
    \item The system updates the password and redirects to \textit{Sign In}.
\end{enumerate}
\\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, topsep=0pt, itemsep=1pt]
    \item Incorrect password.
    \item Email already linked to a Google or GitHub account.
    \item Account suspended or disabled.
    \item Invalid or expired reset link.
\end{itemize}
\\
\hline

\end{longtable}

%------------------------------------------------

\subsection{Use Case Refinement: ``Manage Users''}

Table \ref{tab:uc-manageusers} illustrates the refinement of the "Manage Users" use case.

\renewcommand{\arraystretch}{1.2}
\small

\begin{longtable}{|>{\raggedright\arraybackslash}p{3.1cm}|>{\raggedright\arraybackslash}p{10.9cm}|}
\caption{Use Case Refinement — Manage Users}
\label{tab:uc-manageusers}\\

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

\textbf{Actor} & Admin \\
\hline

\textbf{Pre-condition} & Admin is authenticated and has access to the Admin Console with User Management permission. \\
\hline

\textbf{Post-condition} & User accounts are updated according to the performed administrative actions. \\
\hline

\textbf{Main Scenario} &
\begin{enumerate}[leftmargin=*, topsep=0pt, itemsep=1pt]
    \item The Admin opens the \textit{Users} page.
    \item The system displays the \textit{Users Directory}.
    \item The Admin searches, filters, or selects a user account.
    \item The Admin may:
    \begin{enumerate}[label=\alph*), topsep=0pt, itemsep=1pt]
        \item View user details.
        \item Adjust storage quota for a specific user.
        \item Promote a Student to Admin.
        \item Demote an Admin if higher seniority is verified.
        \item Suspend an account.
        \item Delete an account and associated data.
    \end{enumerate}
\end{enumerate}
\\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, topsep=0pt, itemsep=1pt]
    \item Attempt to modify an Admin account with equal or higher seniority.
    \item Attempt to delete the acting Admin's own account.
    \item Invalid quota value.
\end{itemize}
\\
\hline

\end{longtable}

\normalsize

%------------------------------------------------

\subsection{Use Case Refinement: ``View Profile''}
Table \ref{tab:uc-manageprofile} illustrates the refinement of the "View Profile" use case.

\renewcommand{\arraystretch}{1.25}

\begin{longtable}{|>{\raggedright\arraybackslash}p{3.1cm}|>{\raggedright\arraybackslash}p{11cm}|}
\caption{Use Case Refinement — View Profile}
\label{tab:uc-manageprofile}\\

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

\textbf{Actor} & Student \\
\hline

\textbf{Pre-condition} & Student is authenticated and accesses the Dashboard. \\
\hline

\textbf{Post-condition} & Profile information is updated successfully. \\
\hline

\textbf{Main Scenario} &
\begin{enumerate}[leftmargin=*, topsep=0pt, itemsep=1pt]
    \item The student opens the \textit{Profile} page.
    \item The system displays the current profile information.
    \item The student may:
    \begin{itemize}[leftmargin=*, topsep=0pt, itemsep=1pt]
        \item Update the display name.
        \item Modify notification preferences.
    \end{itemize}
    \item The student clicks \textit{Save Changes} or \textit{Cancel}.
    \item The system saves modifications or restores information.
\end{enumerate}
\\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, topsep=0pt, itemsep=1pt]
    \item Name field left empty.
    \item Name exceeds maximum allowed length.
\end{itemize}
\\
\hline

\end{longtable}

\subsection{Use Case Refinement: ``Manage platform configurations''}

Table \ref{tab:uc-platformconfig} illustrates the refinement of the "Manage Platform Configurations" use case.

\renewcommand{\arraystretch}{1.25}

\begin{longtable}{|>{\raggedright\arraybackslash}p{3.1cm}|>{\raggedright\arraybackslash}p{11cm}|}
\caption{Use Case Refinement — Manage platform configurations}
\label{tab:uc-platformconfig}\\

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

\textbf{Actor} & Admin \\
\hline

\textbf{Pre-condition} & Admin is authenticated and has access to the platform configurations module. \\
\hline

\textbf{Post-condition} & platform configurations settings are updated successfully. \\
\hline

\textbf{Main Scenario} &
\begin{enumerate}[leftmargin=*, topsep=0pt, itemsep=1pt]
    \item The Admin opens the \textit{platform configurations} page.
    \item The system displays the current configuration settings.
    \item The Admin may:
    \begin{itemize}[leftmargin=*, topsep=0pt, itemsep=1pt]
        \item Edit the default user storage quota.
        \item Edit the platform capacity ceiling.
        \item Edit the default maximum upload size.
        \item Enable or disable public registration.
    \end{itemize}
    \item The Admin clicks \textit{Save Changes} or \textit{Cancel}.
    \item The system applies modifications or restores previous configuration.
\end{enumerate}
\\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, topsep=0pt, itemsep=1pt]
    \item Invalid storage quota or upload size values.
    \item Platform capacity exceeds allowed limitations.
\end{itemize}
\\
\hline

\end{longtable}

\section{Sprint 1 Design}

This section presents the diagrams associated 
with the functional use cases introduced and refined in the previous section.


\subsection{Diagrams Related to the ``Sign Up'' Use Case}

The corresponding class diagram is represented in Figure \ref{fig:signup-class} below.

\begin{figure}[H]
    \centering
    \includegraphics[width=\textwidth, height=8cm]{diags/sprint1/signup/class.png}
    \caption{Class Diagram — Sign Up}
    \label{fig:signup-class}
\end{figure}
\newpage
The corresponding sequence diagram is represented in Figure \ref{fig:signup-sequence} below.

\begin{figure}[H]
    \centering
    \includegraphics[width=\textwidth]{diags/sprint1/signup/sequence.png}
    \caption{Sequence Diagram — Sign Up}
    \label{fig:signup-sequence}
\end{figure}

\subsection{Diagrams Related to the ``Sign In'' Use Case}

Figure~\ref{fig:oauth-activity} represents the activity diagram associated with the \textit{Sign In} use case with GitHub and Google as external authentication providers.

\begin{figure}[H]
    \centering
    \includegraphics[width=0.4\textwidth, height=0.38\textheight]{diags/sprint1/signin/activityOauth.png}
    \caption{Activity Diagram — OAuth Sign-In (Google / GitHub)}
    \label{fig:oauth-activity}
\end{figure}

\vspace{-0.2cm}

The sequence diagram illustrated in Figure \ref{fig:signin-sequence} presents the chronological interactions between the different system components during the sign-in process.

\begin{figure}[H]
    \centering
    \includegraphics[width=\textwidth]{diags/sprint1/signin/sequence.png}
    \caption{Sequence Diagram — Sign In}
    \label{fig:signin-sequence}
\end{figure}

The authentication process relies on JWT-based authentication. 
The detailed activity diagram describing the JWT authentication workflow is provided in Appendix \ref{appendix:jwt-activity}.
\subsection{Diagrams Related to the ``Manage Users'' Use Case}

In this section, we focus on the Delete User functionality as a representative case of the Manage Users use case. A class diagram and a sequence diagram illustrating the interaction between the Admin and the system during account deletion is presented below.
\newpage
The corresponding sequence diagram is represented in Figure \ref{fig:deleteuser-class} below.

\begin{figure}[H]
    \centering
    \includegraphics[width=\textwidth]{diags/sprint1/manage users/class.png}
    \caption{Class Diagram — Delete User}
    \label{fig:deleteuser-class}
\end{figure}

The corresponding sequence diagram is represented in Figure \ref{fig:deleteuser-sequence} below.

\begin{figure}[H]
    \centering
    \includegraphics[width=\textwidth]{diags/sprint1/manage users/sequence.png}
    \caption{Sequence Diagram — Delete User }
    \label{fig:deleteuser-sequence}
\end{figure}

\subsection{Diagrams Related to the ``View Profile'' Use Case}

In this section we focus specifically on the \textit{Edit Personal Information} functionality.
The corresponding class diagram is represented in Figure \ref{fig:editprofile-class} below.


\begin{figure}[H]
    \centering
    \includegraphics[width=\textwidth]{diags/sprint1/view profile/class.png}
    \caption{Class Diagram — Edit Personal Information}
    \label{fig:editprofile-class}
\end{figure}
The corresponding sequence diagram is represented in Figure \ref{fig:editprofile-sequence} below.

\begin{figure}[H]
    \centering
    \includegraphics[width=\textwidth]{diags/sprint1/view profile/sequence.png}
    \caption{Sequence Diagram — Edit Personal Information}
    \label{fig:editprofile-sequence}
\end{figure}

\subsection{Diagrams Related to the ``Manage platform configurations'' Use Case}

In this section we focus specifically on the administrative configuration functionalities related to platform limitations and access control. The corresponding sequence diagram is represented in Figure \ref{fig:platformconfig-sequence} below illustrating the interaction between the Admin and the system during configuration updates.

\begin{figure}[H]
    \centering
    \includegraphics[width=\textwidth, height=0.8\textheight]{diags/sprint1/manage_platform_config/sequence.png}
    \caption{Sequence Diagram — Manage platform configurations}
    \label{fig:platformconfig-sequence}
\end{figure}
\subsection{Sprint 1 Class Diagram}

Figure \ref{fig:sprint1-class} illustrates the global class diagram corresponding 
to the Sprint 1 use cases.

\begin{figure}[!htbp]
    \centering
    \includegraphics[width=\textwidth, height=0.4\textheight]{diags/sprint1/class.png}
    \caption{Global Class Diagram for Sprint 1 Use Cases}
    \label{fig:sprint1-class}
\end{figure}
%----------------------------------------------%

\section{Sprint 1 Realization}

This phase focuses on the implementation of the core functionalities defined in Sprint 1. The main objective was to transform the previously identified requirements and use cases into fully operational components within the Cognify platform.


Several responsive and interactive interfaces were designed and integrated to ensure smooth communication between users and the system while maintaining an intuitive user experience.
\newpage
\subsection{Authentication Interfaces}

The authentication module manages secure access for both Students and Admins through the Sign In and Sign Up interfaces illustrated in Figures \ref{fig:signin-ui} and \ref{fig:signup-ui}.

\begin{figure}[H]
    \centering
    \begin{minipage}[c]{0.48\textwidth}
        \centering
        \includegraphics[width=\textwidth]{interfaces/ss_of_signin.png}
        \caption{Sign In Interface}
        \label{fig:signin-ui}
    \end{minipage}
    \hfill
    \begin{minipage}[c]{0.48\textwidth}
        \centering
        \includegraphics[width=\textwidth]{interfaces/ss_of_signup.png}
        \caption{Sign Up Interface}
        \label{fig:signup-ui}
    \end{minipage}
\end{figure}




    The Sign Up interface enables new users to create an account by entering the required personal informsation. Validation mechanisms were implemented to ensure data integrity and secure account creation. The registration workflow was designed to provide a simple and user-friendly onboarding experience.
    
    The Sign In interface allows registered users to authenticate securely using their credentials. 
    In addition to traditional authentication, the system integrates third-party OAuth providers, enabling fast login through Google and GitHub accounts. This approach improves usability while reducing friction during the onboarding process (Figure~\ref{fig:google-oauth}, Figure~\ref{fig:github-oauth}).























































    \begin{figure}[H]
        \centering
    
        \begin{minipage}[c]{0.48\textwidth}
            \centering
            \includegraphics[width=\textwidth]{interfaces/sprint1/google_auth.png}
            \caption{Google OAuth Authentication}
            \label{fig:google-oauth}
        \end{minipage}
        \hfill
        \begin{minipage}[c]{0.48\textwidth}
            \centering
            \includegraphics[width=\textwidth]{interfaces/sprint1/github_auth.png}
            \caption{GitHub OAuth Authentication}
            \label{fig:github-oauth}
        \end{minipage}
    
    \end{figure}
\newpage
\subsection{User Management Interface}

The administration module provides centralized control over platform users and their permissions. Figures~\ref{fig:google-oauth} and~\ref{fig:github-oauth} represent this interface, which was designed specifically for Admin actors to facilitate efficient monitoring and management of user accounts.
\begin{figure}[H]
    \centering
    \includegraphics[width=0.9\textwidth]{interfaces/sprint1/users_management.png}
    \caption{User Management Interface}
    \label{fig:manage-users-ui}
\end{figure}

Through this interface, administrators can visualize user details, manage account permissions, edit storage quotas, suspend user activity, and permanently delete accounts when necessary. The interface was designed to simplify administrative operations while ensuring secure and controlled management of platform resources.

\subsection{Profile Management Interface}

The profile management module allows students to consult and update their personal information through a dedicated profile page, as shown in Figure~\ref{fig:profile-ui}.

\begin{figure}[H]
    \centering
    \includegraphics[width=0.6\textwidth]{interfaces/sprint1/profile.png}
    \caption{Profile Interface}
    \label{fig:profile-ui}
\end{figure}
\section{Sprint 1 Testing Phase}

Sprint 1 testing was performed using the Playwright framework on Chromium, Firefox, and WebKit browsers. The goal was to verify the platform’s main features, including authentication, protected access, session handling, and profile management.

Two types of tests were used:
\begin{itemize}
    \item \textbf{Smoke tests:} executed on all browsers to verify the main user flows.
    \item \textbf{Regression tests:} executed on Chromium to verify additional scenarios and edge cases.
\end{itemize}

The test suite produced 90 successful executions from 48 unique test cases, with no failures recorded as shown in Figure \ref{fig:test-execution-summary}.

\begin{figure}[H]
\centering
\includegraphics[width=0.7\textwidth]{interfaces/sprint1/test/execution_summary.png}
\caption{Sprint 1 Playwright test execution summary}
\label{fig:test-execution-summary}
\end{figure}

\subsection{Test Coverage and Validation}

The Sprint~1 test suite validates the platform’s main authentication and access-control features.

Figure~\ref{fig:login-test-cases} presents representative authentication-related test executions, including successful login, invalid credentials handling, and form validation. Figure~\ref{fig:protected-routes-cases} illustrates protected-route and authorization tests, validating route redirection and GuestGate access control behavior.

\begin{figure}[H]
\centering
\includegraphics[width=0.7\textwidth]{interfaces/sprint1/test/login_cases.png}
\caption{Representative authentication test cases}
\label{fig:login-test-cases}
\end{figure}

\begin{figure}[H]
\centering
\includegraphics[width=0.8\textwidth]{interfaces/sprint1/test/protected_routes_cases.png}
\caption{Representative protected-route and authorization test cases}
\label{fig:protected-routes-cases}
\end{figure}


\section{Conclusion}

This chapter presented Sprint~1 of the Cognify platform, focusing on user management and authentification functionalities. The sprint covered the refinement, design, realization, and testing phases of the developed features.

Sprint~1 established the foundational architecture of the platform and prepared the system for the implementation of more advanced features in the following sprints.
\chapter{Sprint 2}
\label{chap:sprint2}
%-----------------------------------------------------------------

\section{Introduction}

This chapter presents Sprint 2 of the Cognify platform, which focuses on content management features.
This sprint therefore represents an important evolution of the platform, moving from basic user access management toward comprehensive academic content organization and platform governance, while establishing a stronger foundation for future intelligent and collaborative features.

\section{Sprint Backlog}

The backlog includes user stories related to subject organization, deleted content recovery, study planning, file supervision, and system policy management, as presented in Table~\ref{tab:sprint2_backlog}.
\vspace{0.5cm}
\begin{table}[H]
\centering
\caption{Sprint 2 Backlog}
\renewcommand{\arraystretch}{1.3}
\setlength{\tabcolsep}{6pt}

\begin{tabular}{|>{\raggedright\arraybackslash}p{12.5cm}|c|}
\hline
\rowcolor{gray!15}
\textbf{User Story} & \textbf{Priority} \\
\hline

As a Student, I can view, create, search, edit, and delete academic subjects. 
& 1 \\
\hline

As a Student, I can access a subject workspace to manage its associated content and resources. 
& 1 \\
\hline

As a Student, I can manage my uploads, including viewing details, editing upload titles, and deleting uploads. 
& 1 \\
\hline

As a Student, I can manage deleted content through a trash system, including restoring materials, permanently deleting them, and emptying the trash. 
& 2 \\
\hline

As a Student, I can define and manage study goals to organize my learning objectives. 
& 1 \\
\hline

As an Admin, I can view and manage uploaded files. 
& 1 \\
\hline

As an Admin, I can configure the trash retention period for deleted files. 
& 2 \\
\hline

\end{tabular}

\label{tab:sprint2_backlog}
\end{table}
\section{Sprint 2 Refinement}

The following section concerns the different use cases implemented in Sprint 2:

\begin{itemize}
    \item Manage Subjects,
    \item Access Subject Workspace,
    \item Manage Uploads,
    \item Manage Trash,
    \item Manage Study Goals,
    \item View Files.
\end{itemize}

\subsection{Sprint 2 Use Case Diagram}

Figure \ref{fig:sprint1-global} below presents the use case diagram for Sprint 2.

\begin{figure}[H]
    \centering
    \includegraphics[width=\textwidth]{diags/sprint2/usecase.png}
    \caption{Use Case Diagram for Sprint 2}
    \label{fig:sprint1-global}
\end{figure}



\subsection{Use Case Refinement: ``Manage subjects''}

Table \ref{tab:uc-managesubjects} illustrates the refinement of the "Manage Subjects" use case.

\renewcommand{\arraystretch}{1.2}
\setlength{\tabcolsep}{6pt}

\begin{longtable}{|p{3cm}|p{10cm}|}

\caption{Use Case Refinement — Manage Subjects}
\label{tab:uc-managesubjects} \\

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

\textbf{Use Case} & Manage Subjects \\
\hline

\textbf{Actor} & Student \\
\hline

\textbf{Pre-condition} & Student is authenticated and has access to dashboard \\
\hline

\textbf{Post-condition} & Subject list is updated according to student actions \\
\hline

\textbf{Main Scenario} &
The student accesses the Subjects page. The system displays the list of subjects. The student may perform:
\begin{itemize}[leftmargin=*, nosep]
    \item Create subject — add a new subject
    \item Search subject — filter subjects by keywords
    \item Edit subject name — update title
    \item Delete subject — remove subject
    \item Access subject workspace — opens subject environment
\end{itemize}

Accessing a subject workspace extends this use case and enables:
\begin{itemize}[leftmargin=*, nosep]
    \item Manage uploads within the subject workspace
\end{itemize}
\\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, nosep]
    \item Invalid or incomplete subject data
    \item Duplicate subject creation
    \item Server error during processing
\end{itemize}
\\
\hline

\end{longtable}

%------------------------------------------------

\subsection{Use Case Refinement: ``View Trash''}

Table \ref{tab:uc-managetrash} illustrates the refinement of the "View Trash" use case.

\renewcommand{\arraystretch}{1.2}
\setlength{\tabcolsep}{6pt}

\begin{longtable}{|p{3cm}|p{10cm}|}

\caption{Use Case Refinement — View Trash}
\label{tab:uc-managetrash} \\

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

\textbf{Use Case} & View Trash \\
\hline

\textbf{Actor} & Student \\
\hline

\textbf{Pre-condition} & Student is authenticated and deleted materials exist in Trash \\
\hline

\textbf{Post-condition} & Trash content is updated according to the performed operations \\
\hline

\textbf{Main Scenario} &
The student accesses the \textit{Trash} page. The system displays deleted materials currently stored in Trash. The student may perform:
\begin{itemize}[leftmargin=*, nosep]
    \item Restore material — restores deleted material to its original location
    \item Delete material — permanently removes selected material
    \item Empty all trash — permanently removes all deleted materials
\end{itemize}

The system validates the request, executes the selected action, refreshes the Trash content, and displays a confirmation message.
\\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, nosep]
    \item Selected material no longer exists
    \item Restoration fails due to missing original context
    \item Server-side error during restoration or deletion
\end{itemize}
\\
\hline

\end{longtable}
\subsection{Use Case Refinement: ``Manage Study Goals''}

Table \ref{tab:uc-managestudygoals} illustrates the refinement of the "Manage Study Goals" use case.

\renewcommand{\arraystretch}{1.2}
\setlength{\tabcolsep}{6pt}

\begin{longtable}{|p{3cm}|p{10cm}|}

\caption{Use Case Refinement — Manage Study Goals}
\label{tab:uc-managestudygoals} \\

\hline
\rowcolor{gray!15}
\textbf{Field} & \textbf{Details} \\
\hline
\endhead

\textbf{Use Case} & Manage Study Goals \\
\hline

\textbf{Actor} & Student \\
\hline

\textbf{Pre-condition} & Student is authenticated and has access to the study goals section \\
\hline

\textbf{Post-condition} & Study goals are created, completed, deleted, or linked to active study sessions successfully \\
\hline

\textbf{Main Scenario} &
The student accesses the \textit{Study Goals} page. The system displays the existing study goals. The student may:
\begin{itemize}[leftmargin=*, nosep]
    \item Create a new study goal by entering the goal title, description, and target deadline
    \item Mark a study goal as completed
    \item Delete a study goal
    \item Start a study session related to a selected study goal
    \item View goal progress and completion status
\end{itemize}

The system validates the provided information, updates the study goals data, refreshes the displayed list, and shows a confirmation message.
\\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, nosep]
    \item Required goal information is missing or invalid
    \item Attempted action on a non-existing study goal
    \item Failure while starting a study session
    \item Server-side error during operation
\end{itemize}
\\
\hline

\end{longtable}

\subsection{Use Case Refinement: ``View Files''}
Table \ref{tab:uc-viewfiles} illustrates the refinement of the "View Files" use case.

\renewcommand{\arraystretch}{1.2}
\setlength{\tabcolsep}{6pt}

\begin{longtable}{|p{3cm}|p{10cm}|}

\caption{Use Case Refinement — View Files}
\label{tab:uc-viewfiles} \\

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

\textbf{Use Case} & View Files \\
\hline

\textbf{Actor} & Admin \\
\hline

\textbf{Pre-condition} & Admin is authenticated and accessing file management\\
\hline

\textbf{Post-condition} & File list is updated. \\
\hline

\textbf{Main Scenario} &
The Admin accesses the \textit{Files} page. The system displays uploaded platform files. The Admin may perform:
\begin{itemize}[leftmargin=*, nosep]
    \item Filter files based on specific criteria
    \item Search files using keywords
    \item Sort files according to selected attributes
    \item Download selected files
    \item Delete files from the platform
    \item Edit trash retention period
\end{itemize}

The system validates request, executes operation, refreshes file list, and displays confirmation.
\\
\hline

\textbf{Exception Cases} &
Server-side error during file processing

\\
\hline

\end{longtable}

%-----------------------------%

\section{Sprint 2 Design}

This section presents the activity, sequence, and class diagrams associated
with the functional use cases introduced and refined in the previous section.

%-------------------------------------%
\subsection{Diagrams Related to the ``Manage Subjects'' Use Case}

In this section, we present the diagrams associated with the "Manage Subjects" use case.

The corresponding class diagram is represented in Figure \ref{fig:managesubjects-class} below.

\begin{figure}[htbp]
    \centering
    \includegraphics[width=1\textwidth, height=5cm]{diags/sprint2/manage_subjects/class.png}
    \caption{Class Diagram — Manage Subjects}
    \label{fig:managesubjects-class}
\end{figure}

The corresponding sequence diagram is represented in Figure \ref{fig:managesubjects-sequence} below.
\begin{figure}[H]
    \centering
    \includegraphics[width=\textwidth]{diags/sprint2/manage_subjects/sequence.png}
    \caption{Sequence Diagram — Manage Subjects}
    \label{fig:managesubjects-sequence}
\end{figure}

%-----------------------------------%
\subsection{Diagrams Related to the ``View Trash'' Use Case}


In this section, we present the UML diagrams associated with the "View Trash" use case.

The corresponding class diagram is represented in Figure \ref{fig:trash-class} below.

\begin{figure}[htbp]
    \centering
    \includegraphics[width=0.9\textwidth]{diags/sprint2/view_trash/class.png}
    \caption{Class Diagram — View Trash}
    \label{fig:trash-class}
\end{figure}

The corresponding sequence diagram is represented in Figure \ref{fig:trash-sequence} below.

\begin{figure}[H]
    \centering
    \includegraphics[width=\textwidth]{diags/sprint2/view_trash/sequence.png}
    \caption{Sequence Diagram — View Trash}
    \label{fig:trash-sequence}
\end{figure}

\newpage
%-----------------------------------------%
\subsection{Diagrams Related to the ``Manage Files'' Use Case}

In this section, we present the UML diagrams associated with the "Manage Files" use case.

%The corresponding class diagram is represented in Figure \ref{fig:managefiles-class} below.
%\begin{figure}[htbp]
%    \centering
%    \includegraphics[width=0.9\textwidth]{diags/sprint2/files/class.png}
%    \caption{Class Diagram — Manage Files}
%    \label{fig:managefiles-class}
%\end{figure}

The corresponding sequence diagram is represented in Figure \ref{fig:managefiles-sequence} below.

\begin{figure}[H]
    \centering
    \includegraphics[width=\textwidth]{diags/sprint2/files/sequence.png}
    \caption{Sequence Diagram — Manage Files}
    \label{fig:managefiles-sequence}
\end{figure}


%-----------------------------------------%
\newpage
\subsection{Sprint 2 Class Diagram}

Figure \ref{fig:sprint2-class} illustrates the global class diagram corresponding
to the Sprint 2 use cases.

\begin{figure}[H]
    \centering
    \includegraphics[width=\textwidth]{diags/sprint2/class.png}
    \caption{Global Class Diagram for Sprint 2 Use Cases}
    \label{fig:sprint2-class}
\end{figure}



\section{Sprint 2 Realization}

This phase focuses on the implementation of the functionalities defined in Sprint 2. The objective was to transform the designed use cases and diagrams into functional modules integrated within the Cognify platform.

Several key interfaces were developed to improve academic organization for students and operational management for administrators.

\subsection{Subjects Management Interface}
Figure~\ref{fig:subjects-ui} represents the subjects management interface  allows students to create, search, edit, and delete academic subjects.

\begin{figure}[H]
    \centering

    \begin{minipage}[c]{0.48\textwidth}
        \centering
        \includegraphics[width=\textwidth]{interfaces/sprint2/subjects1.png}
    \end{minipage}
    \hfill
    \begin{minipage}[c]{0.48\textwidth}
        \centering
        \includegraphics[width=\textwidth]{interfaces/sprint2/subjects2.png}
    \end{minipage}

    \caption{Subjects Management Interface}
    \label{fig:subjects-ui}
\end{figure}

\subsection{Access Workspace and View Uploads Interface}
The subject workspace interface (Figure~\ref{fig:files-ui}) provides students with centralized access to uploaded educational resources and generated learning materials within a dedicated subject environment. From this workspace, users can navigate through their content, view uploaded files, and manage learning resources through an organized and structured interface.
\begin{figure}[H]
    \centering
    \includegraphics[width=\textwidth]{interfaces/sprint2/workspace.png}
    \caption{Files Management Interface}
    \label{fig:files-ui}
\end{figure}


\subsection{System Rules Interface}
The System Rules Interface (Figure~\ref{fig:rules-ui}) allows administrators to configure platform-wide operational policies, including system constraints and behavioral rules that govern core platform operations.

\begin{figure}[H]
    \centering

    \begin{minipage}[c]{0.48\textwidth}
        \centering
        \includegraphics[width=\textwidth]{interfaces/sprint2/rules1.png}
    \end{minipage}
    \hfill
    \begin{minipage}[c]{0.48\textwidth}
        \centering
        \includegraphics[width=\textwidth]{interfaces/sprint2/rules2.png}
    \end{minipage}

    \caption{System Rules Interface}
    \label{fig:rules-ui}
\end{figure}
\section{Sprint 2 Testing Phase}

\section{Conclusion}
Sprint 2 delivered the core content management layer of Cognify, enabling students to organize subjects, manage uploads within dedicated workspaces, and recover deleted content through a trash system. Administrative file supervision and configurable retention policies further strengthened platform governance, laying the foundation for the intelligent features introduced in subsequent sprints.
\chapter{Sprint 3}
\label{chap:sprint3}
%-----------------------------------------------------------------

\section{Introduction}

This chapter presents Sprint 3 of Cognify, which focuses on building the document processing and content generation layer.
It explains how uploaded academic content is transformed into quizzes, summaries, flashcards, and exams through an asynchronous pipeline based on Celery, Redis, and Ollama.
The chapter is structured around the sprint backlog, use case refinement, system design, and realization of the pipeline.
\vspace{0.2cm}
\section{Sprint Backlog}

Table~\ref{tab:sprint3_backlog} presents the Sprint 3 product backlog, which groups all user stories to be implemented along with their respective priorities.
\renewcommand{\arraystretch}{1.5}
\setlength{\tabcolsep}{8pt}

\begin{longtable}{|p{13cm}|>{\centering\arraybackslash}p{1.5cm}|}

\caption{Sprint 3 Backlog}\label{tab:sprint3_backlog} \\
\hline
\rowcolor{gray!15}
\textbf{User Story} & \textbf{Priority} \\
\hline
\endfirsthead
\hline
\rowcolor{gray!15}
\textbf{User Story} & \textbf{Priority} \\
\hline
\endhead

As a Student, I can upload files (PDF or image) for AI processing. & 3 \\
\hline

As a Student, I can paste or write textual content into the platform. & 3 \\
\hline

As a Student, I can generate summaries from uploaded/written content. & 3 \\
\hline

As a Student, I can generate flashcards from uploaded or written content. & 3 \\
\hline

As a Student, I can generate quizzes from uploaded or written content. & 3 \\
\hline

As a Student, I can generate mock exams from uploaded/written content. & 3 \\
\hline

As a Student, I can get my score after completing a generated mock exam. & 3 \\
\hline

As a Student, I can configure generation settings before generating materials. & 3 \\
\hline

As a Student, I can generate a personalized study plan. & 3 \\
\hline

\end{longtable}
\section{State of the Art and Design Choices}

This section presents an overview and comparative analysis of AI models, embedding systems, and deployment strategies relevant to intelligent educational systems.

\subsection{Presentation of Methods and Technologies}

Large Language Models (LLMs) can be deployed using two main approaches:
\begin{itemize}
    \item \textbf{Local Deployment}: models executed directly on local hardware using frameworks such as Ollama.
    \item \textbf{Cloud/API Deployment}: models accessed through external APIs and cloud infrastructures.
\end{itemize}

Semantic retrieval systems rely on embedding models that transform textual content into dense vector representations for similarity search and contextual retrieval \cite{reimers2019sentencebert}.

Modern AI systems also use different categories of generation backbones, ranging from lightweight local models to large proprietary models optimized for high reasoning performance.

\subsection{Comparative Study}
Table~\ref{tab:embedding-models} compares embedding models used for semantic retrieval systems \cite{touvron2023llama}.
\begin{table}[H]
\centering
\small
\renewcommand{\arraystretch}{1.5}
\setlength{\tabcolsep}{6pt}

\caption{Comparison of Candidate Embedding Models}
\label{tab:embedding-models}

\begin{tabularx}{\textwidth}{
|>{\raggedright\arraybackslash}p{3cm}
|>{\centering\arraybackslash}p{2cm}
|>{\raggedright\arraybackslash}X
|>{\raggedright\arraybackslash}X|}
\hline

\rowcolor{gray!15}
\textbf{Model} &
\textbf{Dimensions} &
\textbf{Strengths} &
\textbf{Weaknesses} \\
\hline

\textbf{nomic-embed-text} &
768 &
Efficient semantic retrieval performance, lightweight execution, and optimized for fully local deployment environments. &
Slightly lower semantic representation quality compared to large proprietary embedding models. \\
\hline

\textbf{text-embedding-3-large} &
3072 &
State-of-the-art semantic representation quality with strong contextual understanding and retrieval accuracy. &
Requires external paid API access and cloud dependency. \\
\hline

\textbf{BGE-large} &
1024 &
High retrieval accuracy and strong benchmark performance for semantic search tasks. &
Higher computational and memory requirements during inference. \\
\hline

\textbf{Instructor-XL} &
768+ &
Instruction-aware embeddings capable of adapting representations to task-specific prompts. &
Slower inference time and increased processing overhead. \\
\hline
\end{tabularx}
\end{table}
Table~\ref{tab:llm-comparison} compares large language model backbones.


\renewcommand{\arraystretch}{1.5}
\setlength{\tabcolsep}{6pt}

\begin{longtable}{|
>{\raggedright\arraybackslash}p{3cm}
|>{\centering\arraybackslash}p{1cm}
|>{\raggedright\arraybackslash}p{4cm}
|>{\centering\arraybackslash}p{2.2cm}
|>{\raggedright\arraybackslash}p{4.2cm}|}

\caption{Comparison of LLM Backbones  \cite{touvron2023llama}}
\label{tab:llm-comparison}
\\

\hline
\rowcolor{gray!15}
\textbf{Model} &
\textbf{Size} &
\textbf{Performance} &
\textbf{Local Feasibility} &
\textbf{Notes} \\
\hline
\endfirsthead

\hline
\rowcolor{gray!15}
\textbf{Model} &
\textbf{Size} &
\textbf{Performance} &
\textbf{Local Feasibility} &
\textbf{Notes} \\
\hline
\endhead

\hline
\multicolumn{5}{r}{\textit{Continued on next page}}
\\
\endfoot

\hline
\endlastfoot

Qwen2.5:3B &
3B &
Strong structured reasoning and efficient instruction following
&
Excellent
&
Fast inference speed with lightweight resource requirements, making it suitable for local deployment.
\\
\hline

LLaMA 3 8B &
8B &
Strong general reasoning and generation capabilities
&
Medium
&
Provides high-quality outputs but requires significantly more computational resources.
\\
\hline

Mistral 7B \cite{jiang2023mistral} &
7B &
High-quality general-purpose performance
&
Medium
&
Offers a good balance between reasoning quality and efficiency, though heavier than smaller models.
\\
\hline

GPT-4 class models &
--
&
State-of-the-art reasoning and generation performance
&
Not local
&
Accessible only through cloud-based APIs and associated operational costs.
\\
\hline
\end{longtable}
\subsection{Selection of Adopted Methods}
A local-first AI architecture based on Ollama is adopted to ensure privacy preservation, reduced operational cost, and offline capability.

The nomic-embed-text model is selected for semantic retrieval due to its balance between efficiency and embedding quality.

Qwen2.5:3B is selected as the main generation model due to its strong reasoning capability and low inference cost.

GPU acceleration is used when available, while CPU fallback ensures compatibility across environments.
\section{System Architecture}
The architecture is organized into five independent functional layers (Figure~\ref{fig:sprint3_pipeline}).
Each layer communicates with the next in a unidirectional flow: requests enter through the Input layer,
pass through the Backend orchestration and the AI Engine, interact with models and infrastructure,
and responses are returned through the Output layer.
%include figure
\begin{figure}[H]
    \centering
    \includegraphics[width=0.95\textwidth, height=0.3\textheight]{diags/sprint3/pipeline.png}
    \caption{High-Level Architecture of the Cognify Sprint 3 Pipeline}
    \label{fig:sprint3_pipeline}
\end{figure}

\subsection{Asynchronous Processing Architecture}

The system uses Celery and Redis to execute background tasks. Uploaded content is processed by worker instances independently from the API layer.

This ensures:
\begin{itemize}
    \item non-blocking request handling
    \item horizontal scalability
    \item isolation of task failures
\end{itemize}

Progress events are streamed to the frontend.
\subsection{Orchestration Layer}

The orchestration layer manages asynchronous ingestion, retrieval, and generation tasks across the AI pipeline.
Generation requests are dispatched to Celery workers and tracked through unique identifiers, while Redis stores transient execution states and PostgreSQL persists generated materials.

The system also supports real-time streaming generation and automatic retry mechanisms to improve execution reliability.
\subsection{Storage and Persistence Architecture}

The system adopts a hybrid storage model:
\begin{itemize}
    \item \textbf{PostgreSQL + pgvector}: structured data and semantic search
    \item \textbf{Redis}: transient state and job progress
    \item \textbf{Google Drive}: raw document storage
\end{itemize}
\section{AI Model Integration}

This section presents the integration of the LLM within Cognify's generation pipeline, covering how academic content is prepared for retrieval, how the model is configured, and how output quality is ensured.
\subsection{Sources and Document Preprocessing}

The system accepts PDFs, scanned images, and raw text inputs. These are normalized into a unified format for processing.

Text is extracted using PDF parsing or OCR, then segmented into overlapping chunks.

Each chunk is encoded into a 768-dimensional embedding vector and stored in PostgreSQL using pgvector for similarity search.

A RAG mechanism retrieves relevant chunks and injects them into the generation context.
\subsection{Model Configuration}

The generation model is Qwen2.5:3B, configured with controlled parameters:

\begin{itemize}
    \item Temperature adapted per task type
    \item Top-k retrieval for context selection
    \item Limited context window for stability
    \item Map-reduce summarization for large documents
    \item Structured JSON output validation
\end{itemize}

All parameters are configurable via environment variables.
\subsection{Experimental Evaluation}

The system is evaluated across quiz generation, summary generation, flashcards, mock exams, and ingestion tasks.

Evaluation criteria:
\begin{itemize}
    \item factual accuracy
    \item structural quality
    \item pedagogical relevance
\end{itemize}

Latency is measured end-to-end from request to response generation (table \ref{tab:ai_pipeline_evaluation}).

\renewcommand{\arraystretch}{1.45}
\setlength{\tabcolsep}{7pt}

\begin{longtable}{|
>{\raggedright\arraybackslash}p{4.5cm}|
>{\raggedright\arraybackslash}p{5.3cm}|
>{\centering\arraybackslash}p{2.3cm}|
>{\centering\arraybackslash}p{2cm}|}

\caption{Experimental Evaluation of AI Pipelines and Generation Strategies}
\label{tab:ai_pipeline_evaluation}
\\

\hline
\rowcolor{gray!15}
\textbf{Test Case} &
\textbf{Pipeline / AI Strategy} &
\textbf{Relevance (/5)} &
\textbf{Latency (s)} \\
\hline
\endfirsthead

\hline
\rowcolor{gray!15}
\textbf{Test Case} &
\textbf{Pipeline / AI Strategy} &
\textbf{Relevance (/5)} &
\textbf{Latency (s)} \\
\hline
\endhead

\hline
\multicolumn{4}{r}{\textit{Continued on next page}}
\\
\endfoot

\hline
\endlastfoot

Ingestion Pipeline (PDF/Text)
&
Chunking + Embedding + pgvector (RAG preprocessing)
&
4
&
3.10
\\
\hline

Quiz Generation (10Q, intermediate)
&
RAG + LLM (Qwen2.5:3B)
&
5
&
46.16
\\
\hline

Summary Generation (concise mode)
&
RAG + LLM (MAP/REDUCE summarization)
&
5
&
12.34
\\
\hline

Flashcards Generation (10 cards)
&
RAG + LLM structured generation
&
4
&
10.75
\\
\hline

Mock Exam Generation (10Q, static)
&
RAG + LLM multi-type generation + server-side grading (Qwen2.5:3B)
&
4
&
54.30
\\
\hline

\rowcolor{gray!10}
\textbf{Average}
&
\centering --
&
\textbf{4.4 / 5}
&
\textbf{25.33}
\\
\hline

\end{longtable}

\section{Sprint 3 Refinement}
The following section covers the principal use cases implemented in this sprint:
\begin{itemize}
  \item Upload File,
  \item Generate Quiz,
  \item Generate Mock Exam,
  \item Generate Summary,
  \item Generate Flashcards,
  \item Generate Study Plan.
\end{itemize}

\section{Sprint 3 Use Case Diagram}


Figure~\ref{fig:usecase-sprint3} presents the global use case diagram for Sprint 3.

\begin{figure}[H]
    \centering
    \includegraphics[width=\textwidth, height=10cm]{diags/sprint3/usecase.png}
    \caption{Use Case Diagram — Sprint 3}
    \label{fig:usecase-sprint3}
\end{figure}

\subsection{Use Case Refinement: ``Upload File''}
Table \ref{tab:uc-manageuploads} illustrates the refinement of the "Manage Uploads" use case.

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

Table \ref{tab:uc-generatequiz} illustrates the refinement of the "Generate Quiz" use case.
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
    \item Student clicks \textit{Generate Quiz}.
    \item Student configures quiz parameters (number of questions and mode).
    \item System retrieves relevant academic content.
    \item The LLM generates the questions.
    \item Quiz is displayed to the student.
\end{enumerate}
\\
\hline

\textbf{Adaptive Behavior} &
\begin{enumerate}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item System initializes the student performance state.
    \item Each submitted answer is evaluated in real time.
    \item Difficulty of the next question is resolved by a rule-based controller using response outcome, performance streak, and average response latency as input signals. The next question targets a concept drawn from weak-concept pools, retrieved via cosine similarity search over the subject's embedded chunks.
    \item Process continues iteratively until quiz completion.
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

Table \ref{tab:uc-generatesummary} illustrates the refinement of the "Generate Summary" use case.

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

\textbf{Adaptive Behavior} &
\begin{itemize}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item In \textit{Teach Me} mode, the system incorporates the student's adaptive profile into the generation process. The profile contains the recommended difficulty level and prioritized weak concepts identified from previous learning interactions.
    
    \item Concepts associated with higher retention risk receive additional explanatory emphasis within the generated summary.
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

\vspace{0.3cm}
\subsection{Use Case Refinement: "Generate Study Plan"}

Table \ref{tab:uc-studyplan} illustrates the refinement of the "Generate Study Plan" use case.

\renewcommand{\arraystretch}{1.4}
\setlength{\tabcolsep}{6pt}

\begin{longtable}{|
>{\raggedright\arraybackslash}p{3cm}|
>{\raggedright\arraybackslash}p{10.5cm}|}

\caption{Use Case Description of Study Plan Generation}
\label{tab:uc-studyplan}\\*
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

\textbf{Use Case} &
Generate Study Plan \\
\hline

\textbf{Actor} &
Student \\
\hline

\textbf{Pre-condition} &
Student is authenticated and has at least one active study goal. \\
\hline

\textbf{Post-condition} &
A personalized study plan is generated and displayed successfully. \\
\hline
\textbf{Main Scenario} &
\begin{enumerate}[leftmargin=*, itemsep=1pt, topsep=1pt]
    \item The student requests study plan generation.
    \item The system analyzes the student's goals, learning activity, and weak concepts.
    \item The AI planning module generates a personalized study schedule.
    \item The generated plan is displayed with recommended study sessions and durations.
\end{enumerate}
\\
\hline
\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, itemsep=1pt, topsep=1pt]
\item No active goals available.
\item AI planning service unavailable.
\item Study plan generation timeout.
\end{itemize}
\\
\hline
\end{longtable}

\section{Sprint 3 Design}
This section shows the diagrams related to the intelligent generation and document processing pipeline that was introduced in Sprint 3.

\subsection{Activity Diagram: Upload File}

Figure~\ref{fig:upload-activity} illustrates the activity diagram describing the document upload and asynchronous ingestion flows.
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


\subsection{Activity Diagram: Adaptive Loop}
Figure \ref{fig:adaptive-activity} illustrates the activity flow followed by the system during the adaptive quiz generation process.

\begin{figure}[H]
   \centering
   \includegraphics[
       width=0.4\textwidth, height=0.5\textheight]{diags/sprint3/adaptiveLoop-act.png}
    \caption{Activity Diagram — Adaptive Loop}
    \label{fig:adaptive-activity}
\end{figure}

Figure \ref{fig:quiz-sequence} presents the interactions between the different system components involved in the quiz generation process.

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

\subsection{Activity Diagram: Generate Summary}
Figure \ref{fig:summary-activity} illustrates the workflow executed by the system to generate a learning summary from the uploaded educational content.

\begin{figure}[H]
    \centering
    \includegraphics[width=0.6\textwidth,height=0.8\textheight]{diags/sprint3/gen_summaryAct.png}
    \caption{Activity Diagram — Generate Summary}
    \label{fig:summary-activity}
\end{figure}

\subsection{Sequence Diagram: Generate Study Plan}
The detailed sequence diagram describing the AI-powered study plan generation process is provided in Appendix~\ref{appendix:study-plan-sequence}.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=\textwidth,
        keepaspectratio
    ]{diags/sprint4/generate_study_plan.png}
    \caption{Sequence Diagram — Generate Study Plan}
    \label{fig:Plan-sequence}
\end{figure}

\subsection{Sprint 3 Class Diagram}

Figure~\ref{fig:class-sprint3} presents the principal domain entities and their relationships within the Sprint 3 architecture.


\begin{figure}[H]
    \centering
    \includegraphics[
        width=15cm,height=22cm]{diags/sprint3/classdiag.png}
    \caption{Class Diagram — Sprint 3}
    \label{fig:class-sprint3}
\end{figure}

\section{Sprint 3 Realization}

This section presents the implemented interfaces and generated learning outputs produced by the intelligent content generation pipeline.
\subsection{Upload Interface}

Figure \ref{fig:upload-interface} illustrates the interface used to upload academic documents or provide textual content before AI processing.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=0.6\textwidth,
        keepaspectratio
    ]{interfaces/sprint3/upload.png}
    \caption{Academic Content Upload Interface}
    \label{fig:upload-interface}
\end{figure}
\subsection*{Generation Form}

Figure \ref{fig:generation-form} illustrates the generation interface used to configure AI-generated materials.
The form allows students to select the generation type, difficulty level, number of questions, and other generation options according to the material type.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=0.7\textwidth,
        keepaspectratio
    ]{interfaces/sprint3/generate_quiz.png}
    \caption{Unified Generation Form}
    \label{fig:generation-form}
\end{figure}
\subsection*{Quiz Interface}

Figure \ref{fig:quiz-interface} presents the generated quiz interfaces displayed after the AI generation process.

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
\subsection*{Summary Interface}

Figure \ref{fig:summary-interface} illustrates the generated summary visualization interface.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=0.7\textwidth,
        keepaspectratio
    ]{interfaces/sprint3/summary.png}
    \caption{Generated Summary Interface}
    \label{fig:summary-interface}
\end{figure}

\subsection{Flashcard Interface}

Figure \ref{fig:flashcard-interface} presents the generated flashcard learning interfaces integrated into Cognify.

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
\subsection{Mock Exam Interface}

Figure \ref{fig:exam-interface} illustrates the generated mock exam interfaces and grading workflow.

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

\subsection{Study Plan Interface}

Figure \ref{fig:studyplan} illustrates the Study Plan visualization interface.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=0.7\textwidth,
        keepaspectratio
    ]{interfaces/sprint3/studyplan-interface.png}
    \caption{Study Plan Interface}
    \label{fig:studyplan}
\end{figure}

\section{Conclusion}

This chapter detailed the Sprint 3 architecture and its implementation, tracing the transformation of raw academic content into structured learning artifacts through a staged pipeline. Each stage applies a specific operation — from document ingestion, vector indexing and contextual retrieval, through retrieval-augmented generation, to adaptive content delivery calibrated to the student's proficiency profile.
\chapter{Sprint 4}
\label{chap:sprint4}

%-----------------------------------------------------------------

\section{Introduction}

This chapter presents Sprint 4 of the Cognify platform, focused on learning analytics, study management, and AI-assisted learning features. The sprint includes concept mastery analytics, study session and goal tracking, AI-powered study plan generation, conversational tutoring assistants, and administrative monitoring functionalities.

%-----------------------------------------------------------------

\vspace{0.15cm}
\section{Sprint Backlog}

Table~\ref{tab:sprint4_backlog} presents the Sprint 4 backlog, detailing the user stories to be implemented along with their priorities.

\begin{table}[H]
\centering
\small
\caption{Sprint 4 Product Backlog}

\renewcommand{\arraystretch}{1.7}
\setlength{\tabcolsep}{8pt}

\begin{tabular}{|p{12.5cm}|>{\centering\arraybackslash}p{1.5cm}|}
\hline
\rowcolor{gray!15}
\textbf{User Story} & \textbf{Priority} \\
\hline

As a Student, I can view my learning performance at the global level and filtered by subject. & 1 \\
\hline

As a Student, I can manage study sessions and manually log study time. & 1 \\
\hline

As a Student, I can manage study goals with progress tracking and reminders. & 1 \\
\hline

As a Student, I can generate a personalized AI-powered study plan based on my learning activity and goals. & 1 \\
\hline

As a Student, I can interact with the AI tutor through a persistent conversational interface linked to my learning materials. & 1 \\
\hline

As an Admin, I can view platform statistics, activity analytics, and security information. & 1 \\
\hline

As an Admin, I can manage platform users and permissions. & 1 \\
\hline

As an Admin, I can consult administrative audit logs. & 1 \\
\hline

As an Admin, I can manage and resolve system alerts. & 2 \\
\hline

\end{tabular}

\label{tab:sprint4_backlog}
\end{table}
%-----------------------------------------------------------------

\vspace{0.4cm}
\section{Sprint 4 Refinement}

The sprint refinement phase focused on defining the behavior, interaction flow, and system constraints associated with the learning analytics, study management, and intelligent assistance modules.

The following use cases describe the main functionalities implemented in Sprint 4:

\begin{itemize}
    \item View performance,
    \item View study sessions,
    \item Manage study goals,
    \item Interact with AI tutor,
    \item View logs,
    \item View notifications,
    \item View platform activity.
\end{itemize}

%-----------------------------------------------------------------

\subsection{Sprint 4 Use Case Diagram}

Figure \ref{fig:sprint4-global} illustrates the overall interaction between the actors and the main functionalities implemented during Sprint 4.

\begin{figure}[H]
    \centering
    \includegraphics[width=0.7\textwidth
    ]{diags/sprint4/usecase.png}
    \caption{Global Use Case Diagram of Sprint 4 Functionalities}
    \label{fig:sprint4-global}
\end{figure}

%-----------------------------------------------------------------
\newpage
\vspace{0.3cm}
\subsection{Use Case Refinement: ``View Performance''}

Table \ref{tab:uc-performance} illustrates the refinement of the "View Performance" use case.

\renewcommand{\arraystretch}{1.4}
\setlength{\tabcolsep}{6pt}

\begin{longtable}{|p{3.2cm}|p{11.2cm}|}
\caption{Use Case Refinement — View Performance}
\label{tab:uc-performance} \\

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

\textbf{Actor} & Student \\
\hline

\textbf{Pre-condition} &
Student is authenticated and has recorded learning activity on the platform. \\
\hline

\textbf{Post-condition} &
Performance analytics are displayed successfully. \\
\hline

\textbf{Main Scenario} &
\begin{enumerate}[leftmargin=*, itemsep=2pt]
    \item The Student opens the \textit{Analytics} page.
    \item The system displays global learning statistics.
    \item The Student selects a subject.
    \item The system displays subject-specific analytics, including:
    \begin{itemize}[leftmargin=*, itemsep=1pt]
        \item Concept mastery distribution.
        \item Progress charts and activity statistics.
        \item Weak concepts requiring improvement.
        \item Personalized learning insights.
    \end{itemize}
    \item The Student may filter analytics and dismiss displayed insights.
\end{enumerate}
\\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, itemsep=1pt]
    \item No learning activity recorded for the selected subject.
    \item Analytics service unavailable.
    \item Subject content unavailable for analysis.
\end{itemize}
\\
\hline

\end{longtable}
%-----------------------------------------------------------------

\vspace{0.3cm}
\subsection{Use Case Refinement: ``Manage Study Sessions''}

Table \ref{tab:uc-sessions} illustrates the refinement of the "Manage Study Sessions" use case.
\renewcommand{\arraystretch}{1.4}
\setlength{\tabcolsep}{6pt}

\begin{longtable}{|p{3.2cm}|p{11.2cm}|}
\caption{Use Case Refinement — Manage Study Sessions}
\label{tab:uc-sessions} \\

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

\textbf{Actor} & Student \\
\hline

\textbf{Pre-condition} &
Student is authenticated. \\
\hline

\textbf{Post-condition} &
Study session information and linked goal progress are updated successfully. \\
\hline

\textbf{Main Scenario} &
\begin{enumerate}[leftmargin=*, itemsep=2pt]
    \item The Student opens the \textit{Goals} page.
    \item The system displays the active session and previous study sessions.
    \item The Student may:
    \begin{itemize}[leftmargin=*, itemsep=1pt]
        \item Start a new study session.
        \item End the active session and provide optional activity information.
        \item Manually log study time for a subject.
    \end{itemize}
    \item The system stores the session information and updates linked study goal progress automatically.
\end{enumerate}
\\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, itemsep=1pt]
    \item Attempt to start a session while another session is active.
    \item Attempt to end a non-existing session.
    \item Invalid manually entered study duration.
\end{itemize}
\\
\hline

\end{longtable}
%-----------------------------------------------------------------

\vspace{0.3cm}
\subsection{Use Case Refinement: ``Manage Study Goals''}
Table \ref{tab:uc-goals} illustrates the refinement of the "Manage Study Goals" use case.

\renewcommand{\arraystretch}{1.4}
\setlength{\tabcolsep}{6pt}

\begin{longtable}{|p{3.2cm}|p{11.2cm}|}
\caption{Use Case Refinement — Manage Study Goals}
\label{tab:uc-goals} \\

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

\textbf{Actor} & Student \\
\hline

\textbf{Pre-condition} &
Student is authenticated. \\
\hline

\textbf{Post-condition} &
Study goals are stored and progress tracking is enabled. \\
\hline

\textbf{Main Scenario} &
\begin{enumerate}[leftmargin=*, itemsep=2pt]
    \item The Student opens the Goals page.
    \item The system displays existing goals with their progress information.
    \item The Student may:
    \begin{itemize}[leftmargin=*, itemsep=1pt]
        \item Create a new study goal.
        \item Configure the goal type, target, period, and reminders.
        \item Edit an existing goal.
        \item Delete a goal.
    \end{itemize}
    \item The system validates and stores the goal information.
    \item The system automatically updates goal progress according to recorded study activity.
\end{enumerate}
\\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, itemsep=1pt]
    \item Invalid or incomplete goal information.
    \item Unsupported goal type or period.
    \item Duplicate goal already exists.
    \item Attempt to modify a non-existing goal.
\end{itemize}
\\
\hline

\end{longtable}
%-----------------------------------------------------------------

\vspace{0.3cm}
\subsection{Use Case Refinement: ``Interact with AI Tutor''}

Table \ref{tab:uc-aitutor} illustrates the refinement of the "Interact with AI Tutor" use case.

\renewcommand{\arraystretch}{1.4}
\setlength{\tabcolsep}{6pt}

\begin{longtable}{|p{3.2cm}|p{11.2cm}|}
\caption{Use Case Refinement — Interact with AI Tutor}
\label{tab:uc-aitutor} \\

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

\textbf{Actor} & Student \\
\hline

\textbf{Pre-condition} &
Student is authenticated accessing workspace and AI services are available. \\
\hline

\textbf{Post-condition} &
The AI-generated response is delivered to the Student and the conversation session is updated and persisted successfully. \\
\hline

\textbf{Main Scenario} &
\begin{enumerate}[leftmargin=*, itemsep=2pt]
    \item The Student opens the AI tutor interface.
    \item The system creates or resumes a subject-specific conversation session.
    \item The Student submits a question related to a subject or learning material.
    \item The system processes the request using the current conversation context and indexed learning resources to generate an AI response.
    \item The generated response is progressively displayed to the Student.
    \item The Student may:
    \begin{itemize}[leftmargin=*, itemsep=1pt]
        \item Provide feedback on the response.
        \item Bookmark important messages.
        \item Rename or delete conversation sessions.
    \end{itemize}
\end{enumerate}
\\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, itemsep=1pt]
    \item Empty question submitted.
    \item AI service unavailable.
    \item Response generation timeout.
    \item No indexed materials available for the selected subject.
\end{itemize}
\\
\hline

\end{longtable}

%-----------------------------------------------------------------

\vspace{0.3cm}
\subsection{Use Case Refinement: ``View Platform Activity''}

Table \ref{tab:uc-platformactivity} illustrates the refinement of the "View Platform Activity" use case.
\renewcommand{\arraystretch}{1.8}
\setlength{\tabcolsep}{6pt}

\begin{longtable}{|p{3.5cm}|p{10.5cm}|}

\caption{Use Case Refinement — View Platform Activity}
\label{tab:uc-platformactivity} \\

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

\textbf{Actor} & Admin \\
\hline

\textbf{Pre-condition} &
Admin is authenticated with administrator privileges. \\
\hline

\textbf{Post-condition} &
Platform information is displayed or updated successfully. \\
\hline

\textbf{Main Scenario} &
\begin{enumerate}[leftmargin=*, itemsep=2pt]
    \item The Admin opens the administration dashboard.
    \item The system displays platform statistics, activity analytics, and security information.
    \item The Admin may:
    \begin{itemize}[leftmargin=*, itemsep=2pt]
        \item Manage platform users and permissions.
        \item Browse administrative audit logs.
        \item View and resolve system alerts.
    \end{itemize}
    \item The system stores administrative actions and updates the displayed information.
\end{enumerate}
\\
\hline

\textbf{Exception Cases} &
\begin{itemize}[leftmargin=*, itemsep=2pt]
    \item Platform statistics unavailable.
    \item Audit log retrieval failed.
    \item Unauthorized administrative action attempted.
    \item Attempt to modify protected administrator accounts.
\end{itemize}
\\
\hline

\end{longtable}
%-----------------------------------------------------------------

\section{Sprint Design}

This section presents the design phase of Sprint 4, including the class diagram and sequence diagrams that describe the system architecture and dynamic interactions between components.

%-----------------------------------------------------------------


%-----------------------------------------------------------------


\subsection{Sequence Diagram: View Performance}

The following sequence diagram ( Figure \ref{fig:performance-sequence} ) illustrates the interaction flow involved in visualizing student learning analytics and performance statistics.


\begin{figure}[H]
    \centering
    \includegraphics[
        width=\textwidth,
        keepaspectratio
    ]{diags/sprint4/viewperformance.png}
    \caption{Sequence Diagram — View Performance}
    \label{fig:performance-sequence}
\end{figure}

\subsection{Sequence Diagram: View Notifications}

The notification management workflow allows administrators to consult and monitor system-generated alerts and platform notifications.

Figure \ref{fig:notifications-sequence} illustrates the interaction sequence involved in retrieving and displaying administrative notifications.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=\textwidth,
        keepaspectratio
    ]{diags/sprint4/view_notifications.png}
    \caption{Sequence Diagram — View Notifications}
    \label{fig:notifications-sequence}
\end{figure}

\subsection{Sequence Diagram: View Audit Logs}

Audit log consultation enables administrators to monitor platform actions, security events, and system-level activities for traceability purposes.

Figure \ref{fig:logs-sequence} presents the interaction flow associated with retrieving and visualizing administrative audit logs.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=0.8\textwidth,
        keepaspectratio
    ]{diags/sprint4/view_logs.png}
    \caption{Sequence Diagram — View Audit Logs}
    \label{fig:logs-sequence}
\end{figure}

\subsection{Activity Diagram: Interact with AI Tutor}

The AI tutor interaction workflow enables students to communicate with a conversational assistant directly from the subject workspace while consulting learning resources and educational content. Through this workflow, students can submit questions, receive AI-generated responses, and manage their ongoing discussion sessions.

Figure \ref{fig:ai-tutor-activity} illustrates the activity flow governing the the student-AI tutor interactions.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=0.7\textwidth,
        keepaspectratio
    ]{diags/sprint4/chatbot.png}
    \caption{Activity Diagram — Interact with AI Tutor}
    \label{fig:ai-tutor-activity}
\end{figure}
\subsection{Sequence Diagram: View Platform Activity}

Administrative activity monitoring relies on analytics services capable of aggregating platform statistics, user activity, and system-level information.

Figure \ref{fig:Act-sequence} illustrates the interaction flow associated with platform activity visualization and analytics retrieval.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=\textwidth,
        keepaspectratio
    ]{diags/sprint4/view_platform_activity.png}
    \caption{Sequence Diagram — View Platform Activity}
    \label{fig:Act-sequence}
\end{figure}

\subsection{Sprint 4 Class Diagram}

This subsection presents the class diagram of Sprint 4, which illustrates the main entities involved in learning analytics, study management, and AI-assisted learning, as well as the relationships between them.

\begin{figure}[H]
    \centering
    \includegraphics[width=0.9\textwidth, height=1\textheight]{diags/sprint4/sprint4-classdiag.png}
    \caption{Sprint 4 Class Diagram}
    \label{fig:sprint4-class}
\end{figure}

%-----------------------------------------------------------------

\section{Sprint 4 Realization}

This section presents the realization phase of Sprint 4, detailing how the designed functionalities were implemented and integrated within the platform.

%-----------------------------------------------------------------

\subsection{Learning Analytics Implementation}

The learning analytics module exposes two levels of analysis. At the global level, a cross-subject dashboard summarizes overall engagement and presents a 15-week activity heatmap, offering a longitudinal view of study regularity. At the subject level, the dashboard provides concept mastery distributions, progress charts and a ranked list of the weakest concepts. The system additionally generates personalized insights derived from performance patterns.
Figures \ref{fig:performance-analytics} and \ref{fig:performance-analytics2} illustrate the learning analytics dashboard.

\begin{figure}[H]
    \centering

    \begin{minipage}[c]{0.49\textwidth}
        \centering
        \includegraphics[
            width=\textwidth,
            keepaspectratio
        ]{interfaces/sprint4/learninganalytics1.jpeg}
        \caption{Performance Analytics Interface}
        \label{fig:performance-analytics}
    \end{minipage}
    \hfill
    \begin{minipage}[c]{0.49\textwidth}
        \centering
        \includegraphics[
            width=\textwidth,
            keepaspectratio
        ]{interfaces/sprint4/learninganalytics2.jpeg}
        \caption{Learning Activity Heatmap Interface}
        \label{fig:performance-analytics2}
    \end{minipage}

\end{figure}
%-----------------------------------------------------------------

\subsection{Study Session Management Implementation}

The study session module tracks student learning activity at a granular level. Each session is associated with a student and can be optionally linked to a specific subject, study goal, or learning material, providing contextual traceability. Sessions are typed — covering study, quiz, exam, review, and manual log variants — allowing the system to distinguish between structured and informal study activity.

The implementation supports two recording modes: explicit sessions with a defined start and end event, during which the frontend displays a live elapsed timer, and manual time entries for offline or untracked learning periods (bounded between 1 and 480 minutes). When a session is concluded, the student may annotate it with notes, the number of materials consulted, and the number of questions answered.

Figure \ref{fig:session-interface} illustrates the study session management interface, presenting active session tracking, elapsed time monitoring, and session organization features.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=0.7\textwidth,
        keepaspectratio
    ]{interfaces/sprint4/session.jpeg}
    \caption{Study Session Management Interface}
    \label{fig:session-interface}
\end{figure}

In addition to session tracking, the platform integrates a goal management mechanism enabling students to define personalized learning objectives associated with duration targets, study frequency, or subject-specific progression. 
Study goals are continuously updated according to recorded learning activity, ensuring automatic synchronization between completed sessions and progression indicators.

This integration enables the platform to maintain dynamic progress tracking while providing students with measurable visibility into their learning consistency and achievement evolution.

Critically, session completion triggers a database-level mechanism that automatically recalculates the progress of any linked study goal, eliminating the need for manual synchronization.

\subsection{AI Tutor Implementation}

Sprint 4 integrates two distinct AI conversational components. The primary component is a subject-scoped chat tutor that maintains persistent chat sessions per subject. Each student message is forwarded to the AI engine alongside the full conversation history and the identifiers of relevant indexed materials, enabling contextually grounded responses. Responses are delivered incrementally via Server-Sent Events (SSE), reducing perceived latency. Each completed exchange is stored with its source citations and a confidence score; students may further annotate messages with positive or negative feedback and bookmark responses for subsequent retrieval. Chat sessions can be renamed and deleted independently.

Figure \ref{fig:ai-tutor-chat} illustrates the subject-scoped AI tutor interface, including streaming responses, citations, and user feedback options.
%manhotouch interfaces hedhom lkol, too much
\begin{figure}[H]
    \centering
    \includegraphics[width=0.4\textwidth]{interfaces/sprint4/chatbot.png}
    \caption{AI Subject Tutor Chat Interface with Streaming Responses and Citations}
    \label{fig:ai-tutor-chat}
\end{figure}


\subsection{Administrative Module Implementation}

The administrative module provides centralized system observability through a role-protected dashboard dedicated to monitoring platform behavior and operational analytics. 
Its functionality focuses on three principal areas: platform activity supervision, audit log monitoring, and real-time notification tracking.

\vspace{0.2cm}

The analytics dashboard aggregates platform-wide indicators related to learner engagement, AI generation activity, and overall system utilization. 
It provides administrators with real-time insights into user activity, educational content generation statistics, processing latency, and operational trends.


\subsection{View Platform Activity Interfaces}

The platform activity module provides administrators with a centralized environment for supervising learner engagement, monitoring AI generation services, and analyzing operational platform behavior in real time.

The analytics interfaces aggregate several categories of indicators, including learner activity evolution, study session statistics, AI generation volume, processing latency, generation quality ratings, and system operational events. 
These dashboards enable administrators to evaluate both educational platform usage and AI engine performance through interactive visual monitoring components.

Figures \ref{fig:activity-overview}, \ref{fig:live-pulse}, \ref{fig:engine-diagnostics}, and \ref{fig:generation-analytics} illustrate the different interfaces related to platform activity supervision.

\begin{figure}[H]
    \centering

    \begin{minipage}[t]{0.49\textwidth}
        \centering
        \includegraphics[
            width=\textwidth,
            keepaspectratio
        ]{interfaces/sprint4/systemanalytics1.png}
        \caption{Platform Engagement Overview}
        \label{fig:activity-overview}
    \end{minipage}
    \hfill
    \begin{minipage}[t]{0.49\textwidth}
        \centering
        \includegraphics[
            width=\textwidth,
            keepaspectratio
        ]{interfaces/sprint4/systemanalytics2.png}
        \caption{Live Activity Stream Monitoring}
        \label{fig:live-pulse}
    \end{minipage}

    \vspace{0.4cm}

    \begin{minipage}[t]{0.49\textwidth}
        \centering
        \includegraphics[
            width=\textwidth,
            keepaspectratio
        ]{interfaces/sprint4/systemanalytics3.png}
        \caption{AI Engine Diagnostics Dashboard}
        \label{fig:engine-diagnostics}
    \end{minipage}
    \hfill
    \begin{minipage}[t]{0.49\textwidth}
        \centering
        \includegraphics[
            width=\textwidth,
            keepaspectratio
        ]{interfaces/sprint4/systemanalytics4.png}
        \caption{Generation Analytics and Performance Metrics}
        \label{fig:generation-analytics}
    \end{minipage}

\end{figure}

The first interface presents global engagement indicators such as registered learners, active users, study sessions, and activity evolution over time. 
The second interface focuses on real-time operational monitoring by displaying live administrative events, system actions, and recent platform activity streams.

The third interface provides diagnostic analytics related to the AI processing engine, including generation success rate, average execution duration, and operational workload distribution. 
Finally, the fourth dashboard presents detailed educational generation metrics such as content-type distribution, processing latency per generation task, satisfaction ratings, and generation difficulty statistics.
\vspace{0.3cm}

Administrative logs provide traceability for critical system events and administrative actions. 
The logging interface enables administrators to inspect authentication events, configuration changes, storage operations, and sensitive platform activities through categorized monitoring views.

Figure \ref{fig:system-logs} presents the system log monitoring interface.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=0.82\textwidth,
        keepaspectratio
    ]{interfaces/sprint4/logs.png}
    \caption{System Logs Monitoring Interface}
    \label{fig:system-logs}
\end{figure}

\vspace{0.2cm}

The notification subsystem provides administrators with real-time alerts related to operational events, warnings, and platform status updates. 
This mechanism improves responsiveness by centralizing important system information within a dedicated notification interface.

Figure \ref{fig:admin-notifications} illustrates the administrative notification center.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=0.3\textwidth,
        keepaspectratio
    ]{interfaces/sprint4/notifications.png}
    \caption{Administrative Notifications Interface}
    \label{fig:admin-notifications}
\end{figure}\subsection{Integration Overview}

The realization of Sprint 4 is characterized by strong interdependencies between its subsystems, forming a tightly integrated adaptive learning architecture. Study sessions act as the primary data source for both the analytics engine and the goal progress tracking system, establishing a shared event backbone across modules.

The analytics layer processes this data to generate weak concept indicators and mastery averages, which are subsequently consumed by the study plan generation module to ensure that AI-generated schedules are grounded in actual learner performance rather than static assumptions. Study goals are continuously updated based on session activity, ensuring real-time synchronization between learning behavior and objective tracking.

The subject-scoped AI tutor leverages both indexed learning materials and session-level conversation history to generate context-aware responses. In parallel, the agentic planner assistant operates on the current goal and task state to translate natural-language requests into structured planning actions.

Overall, these interactions form a closed feedback loop in which learning activity, performance analysis, planning, and AI assistance continuously reinforce one another within a unified adaptive learning system.
\section{Conclusion}

Sprint 4 significantly enhanced the Cognify platform by introducing advanced learning analytics and intelligent assistance features.  
The integration of performance tracking, adaptive study planning, and AI-driven tutoring improved the personalization of the learning experience, while the administrative tools provided better system oversight and user management capabilities.
\chapter*{General Conclusion}
\markboth{General Conclusion}{} %pour afficher l'entete
\addcontentsline{toc}{chapter}{General Conclusion}
The rapid evolution of digital education has highlighted the limitations of traditional e-learning platforms, which often provide static and non-personalized learning experiences. In this context, the objective of this project was to design and develop Cognify, an intelligent adaptive e-learning platform capable of delivering personalized educational support through artificial intelligence technologies and learner-centered adaptation mechanisms.

Throughout this project, a complete full-stack solution was implemented by combining modern web technologies with an AI-driven backend architecture. The platform integrates a complete learning workflow, ranging from content ingestion and structuring to intelligent generation and adaptive learning delivery. These mechanisms enable educational resources to be transformed into structured knowledge that can be dynamically reused across multiple learning services such as quizzes, summaries, flashcards, and exams.

One of the major contributions of this work lies in the design and implementation of an adaptive learning architecture. Unlike conventional learning systems, Cognify continuously analyzes learner interactions, response accuracy, progression patterns, and conceptual weaknesses in order to personalize the educational experience. This adaptive layer powers key features such as personalized study plan generation, adaptive assessments, AI-generated learning materials, and dynamic difficulty adjustment. By integrating learner modeling and feedback-driven adaptation, the platform ensures a more engaging and effective learning experience tailored to each student.

In addition to its functional capabilities, the proposed system was designed with a modular and scalable architecture. The clear separation between the frontend application and the AI processing engine facilitates maintainability and future extensibility. Furthermore, the use of retrieval-based mechanisms ensures efficient and context-aware access to learning content while preserving system flexibility and performance.

Overall, this project demonstrates how artificial intelligence and adaptive system design can significantly enhance modern e-learning environments by moving beyond static content delivery toward personalized and intelligent educational assistance. The developed platform provides a strong foundation for future improvements and research in adaptive digital learning systems.

As future work, several extensions can be considered to further enhance the platform. First, the introduction of a dual environment structure, consisting of private and public repositories, would enable better content organization, collaboration, and version control for learning materials. Second, the development of a dedicated mobile application would improve accessibility and allow learners to interact with the platform seamlessly across devices. Finally, the integration of a tutoring avatar could provide a more immersive and interactive learning experience through visual, conversational, and potentially multimodal guidance, reinforcing the role of the AI tutor within the system.

















