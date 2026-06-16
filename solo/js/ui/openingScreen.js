// Opening screen: "Who am I?" — name input + personality quiz
// Returns a promise that resolves with { name, biases } when the player starts.

const QUIZ_QUESTIONS = [
    {
        key: 'firstImpulse',
        prompt: 'You wake up in an unfamiliar place. What do you do first?',
        choices: [
            { label: 'Look around carefully', bias: 'explore', weight: 1.4 },
            { label: 'Check if I\'m hungry or thirsty', bias: 'survive', weight: 1.4 },
            { label: 'Try to remember how I got here', bias: 'ponder', weight: 1.4 },
        ]
    },
    {
        key: 'resourcePriority',
        prompt: 'You spot a rock, a bush, and a patch of fiber grass. Which do you approach?',
        choices: [
            { label: 'The rock — tools matter', bias: 'craft', weight: 1.3 },
            { label: 'The bush — food first', bias: 'survive', weight: 1.3 },
            { label: 'The grass — versatile material', bias: 'explore', weight: 1.3 },
        ]
    },
    {
        key: 'socialTendency',
        prompt: 'You hear movement nearby. Another person might be close.',
        choices: [
            { label: 'Call out — maybe we can help each other', bias: 'social', weight: 1.4 },
            { label: 'Stay quiet and watch', bias: 'explore', weight: 1.2 },
            { label: 'Keep doing what I was doing', bias: 'craft', weight: 1.2 },
        ]
    },
    {
        key: 'longTermDrive',
        prompt: 'If you could build one thing right now, what would it be?',
        choices: [
            { label: 'A shelter — safety first', bias: 'build', weight: 1.4 },
            { label: 'A tool — to work more efficiently', bias: 'craft', weight: 1.4 },
            { label: 'A map — to understand this place', bias: 'explore', weight: 1.4 },
        ]
    }
]

// Initial spawn thoughts — shown as the pawn takes its first steps
const SPAWN_THOUGHTS = [
    { text: 'I don\'t know where I am. Let\'s explore.', delay: 0 },
    { text: 'I\'ll need to find some food to last the day.', delay: 4000 },
    { text: 'I should remember where this water is.', delay: 10000 },
]

function createOpeningScreen() {
    let resolvePromise

    const promise = new Promise((resolve) => {
        resolvePromise = resolve
    })

    const overlay = document.createElement('div')
    overlay.id = 'opening-screen'
    overlay.style.display = 'none'

    const container = document.createElement('div')
    container.className = 'opening-container'

    // Title
    const title = document.createElement('h2')
    title.className = 'opening-title'
    title.textContent = 'Who am I?'

    // Name input
    const nameGroup = document.createElement('div')
    nameGroup.className = 'opening-name-group'

    const nameLabel = document.createElement('label')
    nameLabel.className = 'opening-label'
    nameLabel.textContent = 'Call me…'

    const nameInput = document.createElement('input')
    nameInput.id = 'opening-name'
    nameInput.type = 'text'
    nameInput.placeholder = 'Your name'
    nameInput.maxLength = 24
    nameInput.autocomplete = 'off'
    nameInput.style.outline = 'none'

    nameGroup.appendChild(nameLabel)
    nameGroup.appendChild(nameInput)

    // Quiz container
    const quizContainer = document.createElement('div')
    quizContainer.id = 'opening-quiz'
    quizContainer.style.display = 'none'

    let currentQuestion = 0
    const answers = {}

    function renderQuestion() {
        quizContainer.innerHTML = ''
        const q = QUIZ_QUESTIONS[currentQuestion]
        if (!q) return

        const progress = document.createElement('div')
        progress.className = 'opening-progress'
        progress.textContent = `${currentQuestion + 1} / ${QUIZ_QUESTIONS.length}`

        const prompt = document.createElement('p')
        prompt.className = 'opening-prompt'
        prompt.textContent = q.prompt

        const choicesDiv = document.createElement('div')
        choicesDiv.className = 'opening-choices'

        for (const choice of q.choices) {
            const btn = document.createElement('button')
            btn.className = 'opening-choice'
            btn.textContent = choice.label
            btn.onclick = () => {
                answers[q.key] = { bias: choice.bias, weight: choice.weight }
                currentQuestion++
                if (currentQuestion < QUIZ_QUESTIONS.length) {
                    renderQuestion()
                } else {
                    finishQuiz()
                }
            }
            choicesDiv.appendChild(btn)
        }

        quizContainer.appendChild(progress)
        quizContainer.appendChild(prompt)
        quizContainer.appendChild(choicesDiv)
    }

    function finishQuiz() {
        quizContainer.innerHTML = ''
        const fadeMsg = document.createElement('p')
        fadeMsg.className = 'opening-fade'
        fadeMsg.textContent = 'Opening your eyes…'
        quizContainer.appendChild(fadeMsg)
        quizContainer.style.display = 'block'

        setTimeout(() => {
            resolvePromise({
                name: nameInput.value.trim() || 'Wanderer',
                biases: answers,
            })
            overlay.remove()
        }, 1500)
    }

    // Start button
    const startBtn = document.createElement('button')
    startBtn.id = 'opening-start'
    startBtn.className = 'opening-start-btn'
    startBtn.textContent = 'Begin'
    startBtn.style.display = 'none'
    startBtn.onclick = () => {
        startBtn.style.display = 'none'
        nameGroup.style.display = 'none'
        quizContainer.style.display = 'block'
        renderQuestion()
    }

    // Show start button when name is entered
    nameInput.addEventListener('input', () => {
        startBtn.style.display = nameInput.value.trim().length > 0 ? '' : 'none'
    })
    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && nameInput.value.trim().length > 0) {
            startBtn.click()
        }
    })

    // Assemble
    container.appendChild(title)
    container.appendChild(nameGroup)
    container.appendChild(startBtn)
    container.appendChild(quizContainer)
    overlay.appendChild(container)
    document.body.appendChild(overlay)

    // Show with fade-in
    setTimeout(() => {
        overlay.style.display = 'flex'
        nameInput.focus()
    }, 50)

    return promise
}

export { createOpeningScreen, SPAWN_THOUGHTS, QUIZ_QUESTIONS }
