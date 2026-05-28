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
\section{Sprint Refinement}

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

\subsection{Sprint 4 Global Use Case Diagram}

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
\subsection{Use Case Refinement — View Performance}

The following table presents the refinement of the \textit{View Performance} use case, as illustrated in Table~\ref{tab:uc-performance}.

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
\subsection{Use Case Refinement — Manage Study Sessions}

The refinement of the \textit{Manage Study Sessions} use case is presented in Table~\ref{tab:uc-sessions}, detailing the interaction flow and system behavior during study tracking activities.

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
\subsection{Use Case Refinement — Manage Study Goals}
The refinement of the \textit{Manage Study Goals} use case is presented in Table~\ref{tab:uc-goals}, outlining the goal creation, management, and progress tracking workflow within the system.

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
    \item The Student opens the \textit{Goals} page.
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
\subsection{Use Case Refinement — Interact with AI Tutor}

The refinement of the \textit{Interact with AI Tutor} use case is presented in Table~\ref{tab:uc-aitutor}, detailing the conversational flow between the student and the AI system along with context-aware response generation.

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
\subsection{Use Case Refinement — View Platform Activity}

The following table \ref{tab:uc-platformactivity} presents the refinement of the \textit{View Platform Activity} use case.

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

\subsection{Class Diagram}

This subsection presents the class diagram of Sprint 4, which illustrates the main entities involved in learning analytics, study management, and AI-assisted learning, as well as the relationships between them.

\begin{figure}[H]
    \centering
    \includegraphics[width=0.9\textwidth, height=1\textheight]{diags/sprint4/sprint4-classdiag.png}
    \caption{Sprint 4 Class Diagram}
    \label{fig:sprint4-class}
\end{figure}

%-----------------------------------------------------------------


\subsection*{Sequence Diagram: View Performance}

The following sequence diagram ( \ref{fig:performance-sequence} ) illustrates the interaction flow involved in visualizing student learning analytics and performance statistics.


\begin{figure}[H]
    \centering
    \includegraphics[
        width=\textwidth,
        keepaspectratio
    ]{diags/sprint4/viewperformance.png}
    \caption{Sequence Diagram — View Performance}
    \label{fig:performance-sequence}
\end{figure}

\subsection*{Sequence Diagram: View Notifications}

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

\subsection*{Sequence Diagram: View Audit Logs}

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

\subsubsection*{Activity Diagram: Interact with AI Tutor}

The AI tutor interaction workflow enables students to communicate with a conversational assistant directly from the subject workspace while consulting learning resources and educational content. Through this workflow, students can submit questions, receive AI-generated responses, and manage their ongoing discussion sessions within the same learning environment.

Figure \ref{fig:ai-tutor-activity} illustrates the activity flow governing interactions between the student and the AI tutor system.

\begin{figure}[H]
    \centering
    \includegraphics[
        width=0.8\textwidth,
        keepaspectratio
    ]{diags/sprint4/chatbot.png}
    \caption{Activity Diagram — Interact with AI Tutor}
    \label{fig:ai-tutor-activity}
\end{figure}
\subsection*{Sequence Diagram: View Platform Activity}

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

%-----------------------------------------------------------------

\section{Sprint Realization}

This section presents the realization phase of Sprint 4, detailing how the designed functionalities were implemented and integrated within the platform.

%-----------------------------------------------------------------

\subsection{Learning Analytics Implementation}

The learning analytics module transforms raw student activity into structured performance indicators by aggregating three categories of recorded events: quiz attempts, flashcard reviews, and exam submissions. From these sources, the system computes per-concept mastery scores and classifies each concept into one of five states — \textit{critical}, \textit{weak}, \textit{developing}, \textit{mastered}, or \textit{unstarted} — enabling fine-grained identification of knowledge gaps within a given subject.

The module exposes two levels of analysis. At the global level, a cross-subject dashboard summarizes overall engagement and presents a 15-week activity heatmap, offering a longitudinal view of study regularity. At the subject level, the dashboard provides concept mastery distributions, progress charts filterable by day, week, or month, and a ranked list of the weakest concepts. The system additionally generates personalized insights derived from performance patterns; each insight can be individually dismissed by the student once reviewed.
Figures \ref{fig:performance-analytics} and \ref{fig:performance-analytics2} illustrate the learning analytics dashboard, presenting activity statistics, study heatmaps, and performance indicators.

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

Figure \ref{fig:session-overview} illustrates the study session interface, where sessions are organized and linked to their respective subjects and goals.

\begin{figure}[H]
    \centering
%    \includegraphics[width=0.85\textwidth]{interfaces/sprint4/session-overview.png}
    \caption{Study Session Overview Interface}
    \label{fig:session-overview}
\end{figure}

The implementation supports two recording modes: explicit sessions with a defined start and end event, during which the frontend displays a live elapsed timer, and manual time entries for offline or untracked learning periods (bounded between 1 and 480 minutes). When a session is concluded, the student may annotate it with notes, the number of materials consulted, and the number of questions answered.

Figure \ref{fig:session-timer} shows the active study session mode with the live timer, while Figure \ref{fig:manual-session} presents the manual time entry interface.

\begin{figure}[H]
    \centering
%    \includegraphics[width=0.7\textwidth]{interfaces/sprint4/session-timer.png}
    \caption{Active Study Session with Live Timer}
    \label{fig:session-timer}
\end{figure}

\begin{figure}[H]
    \centering
%    \includegraphics[width=0.7\textwidth]{interfaces/sprint4/manual-session.png}
    \caption{Manual Study Session Entry Interface}
    \label{fig:manual-session}
\end{figure}

Critically, session completion triggers a database-level mechanism that automatically recalculates the progress of any linked study goal, eliminating the need for manual synchronization.
%-----------------------------------------------------------------

\subsection{Study Goals and Progress Tracking}

The study goals system allows students to define structured learning objectives parameterized by four dimensions: goal type (\textit{study\_time}, \textit{material\_completion}, \textit{quiz\_completion}, or \textit{exam\_score}), measurement period (\textit{daily}, \textit{weekly}, or \textit{monthly}), a quantitative target value, and an optional subject scope. Goals additionally support reminder scheduling, allowing students to configure specific days of the week and a preferred notification time.

Figure \ref{fig:goal-creation} illustrates the goal creation interface, where students configure goal parameters and scheduling preferences.

\begin{figure}[H]
    \centering
%    \includegraphics[width=0.75\textwidth]{interfaces/sprint4/goal-creation.png}
    \caption{Study Goal Creation Interface}
    \label{fig:goal-creation}
\end{figure}

The validation layer enforces consistent goal constraints, including a minimum title length and a uniqueness rule that prevents duplicate goals sharing the same type, period, and subject. Each goal progresses through a defined lifecycle — \textit{active}, \textit{paused}, \textit{completed}, or \textit{abandoned} — and goal progress is updated automatically via a database trigger each time a relevant session is recorded.

Figure \ref{fig:goal-progress} presents the goal tracking dashboard, where progress is updated dynamically based on study session activity.

\begin{figure}[H]
    \centering
%    \includegraphics[width=0.85\textwidth]{interfaces/sprint4/goal-progress.png}
    \caption{Study Goals Progress Dashboard}
    \label{fig:goal-progress}
\end{figure}

The system further maintains a study streak counter reflecting the number of consecutive days with recorded activity, surfaced on the goals dashboard as a motivational indicator.

Figure \ref{fig:study-streak} highlights the streak tracking component integrated within the goals dashboard.

\begin{figure}[H]
    \centering
%    \includegraphics[width=0.6\textwidth]{interfaces/sprint4/study-streak.png}
    \caption{Study Streak Indicator on Goals Dashboard}
    \label{fig:study-streak}
\end{figure}

%-----------------------------------------------------------------
%fil sprint 3
\subsection{AI-Powered Study Plan Generation}

The study plan generation module produces personalized weekly schedules by combining student-provided preferences with contextual learning data. Before invoking the AI engine, the backend assembles a rich context payload comprising the student's active goals, the top weak concepts with mastery below a defined threshold, an aggregated summary of the past fourteen days of activity, and per-subject mastery averages. This consolidated context, alongside the student's declared number of study days per week and daily hours, is forwarded to the Python-based AI planning engine.

Figure \ref{fig:plan-input-context} illustrates the study plan configuration interface where students define their weekly availability and study preferences before generation.

\begin{figure}[H]
    \centering
%    \includegraphics[width=0.75\textwidth]{interfaces/sprint4/plan-input.png}
    \caption{Study Plan Input Configuration Interface}
    \label{fig:plan-input-context}
\end{figure}

The engine returns a structured schedule composed of discrete sessions, each specifying a day of the week, a focus topic, and an estimated duration in minutes. The generated plan is persisted in the database to survive page navigation.

Figure \ref{fig:generated-plan} presents the AI-generated weekly study plan, where sessions are organized by day and topic.

\begin{figure}[H]
    \centering
%    \includegraphics[width=\textwidth]{interfaces/sprint4/generated-plan.png}
    \caption{AI-Generated Weekly Study Plan}
    \label{fig:generated-plan}
\end{figure}

Before activation, the student may review and adjust individual session durations through the plan review interface. The plan is activated as a final confirmation step, decoupling generation from commitment.

Figure \ref{fig:plan-review} shows the review interface where students can modify session durations before confirming the plan.

\begin{figure}[H]
    \centering
%    \includegraphics[width=0.85\textwidth]{interfaces/sprint4/plan-review.png}
    \caption{Study Plan Review and Adjustment Interface}
    \label{fig:plan-review}
\end{figure}
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

Figures \ref{fig:activity-analytics} and \ref{fig:system-monitoring} illustrate the administrative analytics interfaces used to supervise platform usage and AI engine behavior.

\begin{figure}[H]
    \centering

    \begin{minipage}[t]{0.49\textwidth}
        \centering
        \includegraphics[
            width=\textwidth,
            keepaspectratio
        ]{interfaces/sprint4/systemanalytics1.jpeg}
        \caption{Platform Activity Analytics Interface}
        \label{fig:activity-analytics}
    \end{minipage}
    \hfill
    \begin{minipage}[t]{0.49\textwidth}
        \centering
        \includegraphics[
            width=\textwidth,
            keepaspectratio
        ]{interfaces/sprint4/systemanalytics2.jpeg}
        \caption{AI Engine Monitoring Interface}
        \label{fig:system-monitoring}
    \end{minipage}

\end{figure}

The activity analytics interface presents key indicators such as learner engagement evolution, study session distribution, content generation statistics, and live activity streams. 
The monitoring dashboard additionally exposes AI-oriented operational metrics including processing latency, generation volume, generation success rate, and quality evaluation indicators associated with generated educational resources.

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
        width=0.55\textwidth,
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