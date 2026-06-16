/**
 * Slow Start Quiz — in-game callouts that surface as the pawn wakes up
 * and encounters needs/decision points.
 *
 * Instead of a pre-game quiz, questions appear as callouts to the right
 * of the head mesh. Each question has a long timeout before auto-answering.
 * After all questions are answered, a name milestone flourish appears.
 */

const SLOW_START_QUESTIONS = [
    {
        id: 'firstImpulse',
        trigger: 'wake', // Triggers immediately when pawn wakes
        prompt: 'You wake up in an unfamiliar place. What do you do first?',
        choices: [
            { label: 'Look around', bias: 'explore', weight: 1.4 },
            { label: 'Check for food', bias: 'survive', weight: 1.4 },
            { label: 'Try to remember', bias: 'ponder', weight: 1.4 },
        ],
        autoTimeout: 30000, // 30 seconds before auto-picking first choice
        autoChoice: 0,
    },
    {
        id: 'resourcePriority',
        trigger: 'resource_nearby', // Triggers when pawn is near a resource
        prompt: 'You spot a rock, a bush, and grass. Which do you approach?',
        choices: [
            { label: 'The rock', bias: 'craft', weight: 1.3 },
            { label: 'The bush', bias: 'survive', weight: 1.3 },
            { label: 'The grass', bias: 'explore', weight: 1.3 },
        ],
        autoTimeout: 30000, // 30 seconds
        autoChoice: 1,
    },
    {
        id: 'socialTendency',
        trigger: 'entity_nearby', // Triggers when pawn encounters another entity
        prompt: 'You hear movement nearby. Another being might be close.',
        choices: [
            { label: 'Call out', bias: 'social', weight: 1.4 },
            { label: 'Watch quietly', bias: 'explore', weight: 1.2 },
            { label: 'Keep moving', bias: 'craft', weight: 1.2 },
        ],
        autoTimeout: 30000,
        autoChoice: 1,
    },
    {
        id: 'longTermDrive',
        trigger: 'needs_surface', // Triggers when first need drops below 70
        prompt: 'If you could build one thing right now, what would it be?',
        choices: [
            { label: 'A shelter', bias: 'build', weight: 1.4 },
            { label: 'A tool', bias: 'craft', weight: 1.4 },
            { label: 'A map', bias: 'explore', weight: 1.4 },
        ],
        autoTimeout: 30000, // 30 seconds
        autoChoice: 0,
    },
]

const CALLout_STYLE = `
    position: fixed;
    top: 50%;
    right: 40px;
    transform: translateY(-50%);
    background: rgba(15, 23, 42, 0.88);
    border: 1px solid rgba(94, 196, 192, 0.4);
    border-radius: 8px;
    padding: 16px 20px;
    font-family: Georgia, 'Times New Roman', serif;
    color: #c8c0cc;
    z-index: 1400;
    max-width: 320px;
    min-width: 260px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    opacity: 0;
    transition: opacity 0.6s ease, transform 0.6s ease;
    pointer-events: none;
`

const CHOICE_BTN_STYLE = `
    display: block;
    width: 100%;
    margin-top: 8px;
    padding: 8px 12px;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 14px;
    cursor: pointer;
    background: rgba(30, 41, 59, 0.85);
    color: #cbd5e1;
    border: 1px solid rgba(94, 196, 192, 0.3);
    border-radius: 4px;
    text-align: left;
    transition: background 0.2s ease, border-color 0.2s ease;
    pointer-events: auto;
`

const TIMER_BAR_STYLE = `
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    background: rgba(94, 196, 192, 0.5);
    border-radius: 0 0 8px 8px;
    transition: width linear;
`

// Name milestone flourish
const MILESTONE_STYLE = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: radial-gradient(ellipse at center, rgba(15, 23, 42, 0.95) 0%, rgba(10, 10, 20, 0.98) 100%);
    border: 1px solid rgba(94, 196, 192, 0.5);
    border-radius: 12px;
    padding: 40px 50px;
    font-family: Georgia, 'Times New Roman', serif;
    color: #e2e8f0;
    z-index: 1500;
    text-align: center;
    box-shadow: 0 0 60px rgba(94, 196, 192, 0.2);
    opacity: 0;
    transition: opacity 1s ease;
    pointer-events: none;
`

function setupSlowStartQuiz(pawnGetter, onQuizComplete) {
    const container = document.createElement('div')
    container.id = 'slow-start-quiz'
    container.style.cssText = CALLout_STYLE
    document.body.appendChild(container)

    const answers = {}
    let currentQuestion = null
    let questionIndex = 0
    let autoTimer = null
    let triggeredTriggers = new Set()
    let quizCompleted = false
    let lastTriggerTick = -10 // Minimum ticks between triggers

    // Track which triggers have fired
    function checkTriggers(pawn) {
        if (quizCompleted) return
        // Don't trigger while a question is still visible (fading out)
        if (currentQuestion) return
        const tick = pawn?.world?.clock?.currentTick ?? pawn?.age ?? 0
        // Minimum 25 ticks (~12.5s) between question triggers
        if (tick - lastTriggerTick < 25) return

        for (let i = questionIndex; i < SLOW_START_QUESTIONS.length; i++) {
            const q = SLOW_START_QUESTIONS[i]
            if (triggeredTriggers.has(q.id)) continue

            let shouldTrigger = false

            switch (q.trigger) {
                case 'wake':
                    shouldTrigger = (pawn?.age ?? 0) >= 2 // First tick after initial render
                    break
                case 'resource_nearby':
                    // Check if pawn is near any resource entity
                    shouldTrigger = checkResourceNearby(pawn)
                    break
                case 'entity_nearby':
                    // Check if pawn has encountered another entity
                    shouldTrigger = checkEntityNearby(pawn)
                    break
                case 'needs_surface':
                    // Check if any need has dropped below threshold
                    shouldTrigger = checkNeedsSurface(pawn)
                    break
            }

            if (shouldTrigger) {
                lastTriggerTick = tick
                triggeredTriggers.add(q.id)
                showQuestion(q, i)
                return
            }
        }
    }

    function checkResourceNearby(pawn) {
        // Simple heuristic: pawn has moved at least 30 units from spawn
        const startX = pawn?.spawnX ?? pawn?.x ?? 0
        const startY = pawn?.spawnY ?? pawn?.y ?? 0
        const distance = Math.hypot(pawn.x - startX, pawn.y - startY)
        return distance > 30
    }

    function checkEntityNearby(pawn) {
        // Simple heuristic: pawn has been alive for at least 30 seconds (game time)
        const age = pawn?.age ?? 0
        return age > 30
    }

    function checkNeedsSurface(pawn) {
        const needs = pawn?.needs?.needs
        if (!needs) return false
        // Check if any need has dropped below 70
        for (const key of Object.keys(needs)) {
            if (needs[key] < 70) return true
        }
        return false
    }

    function showQuestion(question, index) {
        currentQuestion = question
        questionIndex = index

        container.innerHTML = ''
        container.style.opacity = '1'
        container.style.pointerEvents = 'auto'

        // Prompt
        const prompt = document.createElement('p')
        prompt.style.cssText = 'margin: 0 0 12px 0; font-size: 14px; line-height: 1.5; font-style: italic;'
        prompt.textContent = question.prompt
        container.appendChild(prompt)

        // Choices
        for (let i = 0; i < question.choices.length; i++) {
            const choice = question.choices[i]
            const btn = document.createElement('button')
            btn.style.cssText = CHOICE_BTN_STYLE
            btn.textContent = choice.label
            btn.onmouseenter = () => {
                btn.style.background = 'rgba(94, 196, 192, 0.2)'
                btn.style.borderColor = 'rgba(94, 196, 192, 0.6)'
            }
            btn.onmouseleave = () => {
                btn.style.background = 'rgba(30, 41, 59, 0.85)'
                btn.style.borderColor = 'rgba(94, 196, 192, 0.3)'
            }
            btn.onclick = () => selectChoice(i)
            container.appendChild(btn)
        }

        // Timer bar
        const timerBar = document.createElement('div')
        timerBar.style.cssText = TIMER_BAR_STYLE
        timerBar.style.width = '100%'
        container.appendChild(timerBar)

        // Start auto-timer
        autoTimer = setTimeout(() => {
            selectChoice(question.autoChoice)
        }, question.autoTimeout)

        // Animate timer bar
        requestAnimationFrame(() => {
            timerBar.style.transition = `width ${question.autoTimeout}ms linear`
            timerBar.style.width = '0%'
        })
    }

    function selectChoice(choiceIndex) {
        if (!currentQuestion) return

        clearTimeout(autoTimer)
        const choice = currentQuestion.choices[choiceIndex]
        answers[currentQuestion.id] = { bias: choice.bias, weight: choice.weight }

        console.log(`[slow-start] ${currentQuestion.id}: ${choice.label} (${choice.bias})`)

        // Fade out
        container.style.opacity = '0'
        container.style.pointerEvents = 'none'

        // Check if quiz is complete
        setTimeout(() => {
            if (Object.keys(answers).length === SLOW_START_QUESTIONS.length) {
                quizCompleted = true
                container.innerHTML = ''
                // Show name milestone flourish
                showNameMilestone()
            } else {
                // Wait for next trigger
                currentQuestion = null
            }
        }, 800)
    }

    function showNameMilestone() {
        const milestone = document.createElement('div')
        milestone.id = 'name-milestone'
        milestone.style.cssText = MILESTONE_STYLE
        document.body.appendChild(milestone)

        milestone.innerHTML = `
            <h2 style="margin: 0 0 8px 0; font-weight: normal; letter-spacing: 2px; color: #94a3b8;">Who am I?</h2>
            <p style="margin: 0 0 20px 0; font-size: 13px; color: #64748b; font-style: italic;">Call me…</p>
        `

        const nameInput = document.createElement('input')
        nameInput.type = 'text'
        nameInput.placeholder = 'Your name'
        nameInput.maxLength = 24
        nameInput.autocomplete = 'off'
        nameInput.style.cssText = `
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 6px;
            padding: 10px 14px;
            color: #e2e8f0;
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 16px;
            letter-spacing: 0.5px;
            outline: none;
            width: 200px;
            text-align: center;
            transition: border-color 0.2s ease;
            pointer-events: auto;
        `
        nameInput.onfocus = () => {
            nameInput.style.borderColor = 'rgba(94, 196, 192, 0.5)'
        }
        nameInput.onblur = () => {
            nameInput.style.borderColor = 'rgba(255, 255, 255, 0.15)'
        }

        const confirmBtn = document.createElement('button')
        confirmBtn.style.cssText = `
            display: none;
            margin-top: 16px;
            padding: 8px 24px;
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 14px;
            cursor: pointer;
            background: rgba(94, 196, 192, 0.15);
            color: #cbd5e1;
            border: 1px solid rgba(94, 196, 192, 0.3);
            border-radius: 6px;
            pointer-events: auto;
            transition: background 0.2s ease;
        `
        confirmBtn.textContent = 'Begin'
        confirmBtn.onmouseenter = () => {
            confirmBtn.style.background = 'rgba(94, 196, 192, 0.25)'
        }
        confirmBtn.onmouseleave = () => {
            confirmBtn.style.background = 'rgba(94, 196, 192, 0.15)'
        }

        nameInput.addEventListener('input', () => {
            confirmBtn.style.display = nameInput.value.trim().length > 0 ? 'inline-block' : 'none'
        })
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && nameInput.value.trim().length > 0) {
                confirmBtn.click()
            }
        })

        const finishName = () => {
            const name = nameInput.value.trim() || 'Wanderer'
            console.log(`[slow-start] Name chosen: ${name}`)

            // Fade out milestone
            milestone.style.opacity = '0'
            setTimeout(() => milestone.remove(), 1200)

            // Resolve with name and biases
            onQuizComplete?.(name, answers)
        }

        confirmBtn.onclick = finishName
        milestone.appendChild(nameInput)
        milestone.appendChild(confirmBtn)

        // Fade in
        requestAnimationFrame(() => {
            milestone.style.opacity = '1'
            nameInput.focus()
        })
    }

    function update(pawn) {
        checkTriggers(pawn)
    }

    function getBiases() {
        return answers
    }

    return { update, getBiases }
}

export { setupSlowStartQuiz, SLOW_START_QUESTIONS }
