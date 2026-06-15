// ===== API =====
const getApiUrl = (nivel) =>
    `https://opentdb.com/api.php?amount=10&type=multiple&difficulty=${nivel}`;

const nivelConfig = {
    easy: { tiempo: 15, puntos: 10 },
    medium: { tiempo: 10, puntos: 20 },
    hard: { tiempo: 7, puntos: 30 }
};

// ===== ESTADO =====
let estado = {
    nivel: null, jugadores: [], indiceJugador: 0,
    preguntas: [], preguntasPorJugador: [],
    indicePregunta: 0, puntaje: 0, correctas: 0, intervalo: null
};

// ===== UTILIDADES =====
const mostrarPantalla = (id) => {
    document.querySelectorAll('.pantalla').forEach(p => p.classList.add('d-none'));
    document.getElementById(`pantalla-${id}`).classList.remove('d-none');
};

const decode = (str) => {
    const txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
};

const mezclar = (arr) => [...arr].sort(() => Math.random() - 0.5);
const letras = ['A', 'B', 'C', 'D'];

// ===== PASO 1: JUGADORES =====
document.querySelectorAll('.btn-jugadores').forEach(btn => {
    btn.addEventListener('click', () => {
        const cantidad = Number(btn.dataset.cantidad);
        const emojis = ['🟣', '🔵', '🟡', '🔴'];
        const grid = document.getElementById('inputs-nombres');

        grid.innerHTML = Array.from({ length: cantidad }, (_, i) => `
      <input
        class="input-nombre"
        id="nombre-${i}"
        type="text"
        placeholder="${emojis[i]} Jugador ${i + 1}"
        maxlength="20"
      />
    `).join('');

        document.getElementById('paso-jugadores').classList.add('d-none');
        document.getElementById('paso-nombres').classList.remove('d-none');
        document.getElementById('nombre-0').focus();
    });
});

// ===== VOLVER A JUGADORES =====
document.getElementById('btn-volver-jugadores').addEventListener('click', () => {
    document.getElementById('paso-nombres').classList.add('d-none');
    document.getElementById('paso-jugadores').classList.remove('d-none');
});

// ===== PASO 2: NOMBRES =====
document.getElementById('btn-continuar-nombres').addEventListener('click', () => {
    const inputs = document.querySelectorAll('.input-nombre');
    const nombres = [...inputs].map((inp, i) => inp.value.trim() || `Jugador ${i + 1}`);
    estado.jugadores = nombres.map(nombre => ({ nombre, puntaje: 0, correctas: 0, total: 0 }));
    document.getElementById('paso-nombres').classList.add('d-none');
    document.getElementById('paso-nivel').classList.remove('d-none');
});

// ===== PASO 3: NIVEL =====
document.querySelectorAll('.btn-nivel').forEach(btn => {
    btn.addEventListener('click', () => {
        estado.nivel = btn.dataset.nivel;
        estado.indiceJugador = 0;
        cargarPreguntas();
    });
});

// ===== CARGAR PREGUNTAS (distintas por jugador) =====
const esperar = (ms) => new Promise(res => setTimeout(res, ms));

async function cargarPreguntas() {
    mostrarPantalla('cargando');
    try {
        const sets = [];
        for (const jugador of estado.jugadores) {
            const res = await fetch(getApiUrl(estado.nivel));
            const data = await res.json();
            if (data.response_code !== 0) throw new Error();
            sets.push(data.results.map(q => {
                const opciones = mezclar([...q.incorrect_answers, q.correct_answer]);
                return {
                    pregunta: decode(q.question),
                    categoria: decode(q.category),
                    opciones: opciones.map(decode),
                    correcta: opciones.indexOf(q.correct_answer)
                };
            }));
            await esperar(1000);
        }
        estado.preguntasPorJugador = sets;
        mostrarTurno();
    } catch {
        mostrarPantalla('error');
    }
}

document.getElementById('btn-reintentar-api').addEventListener('click', cargarPreguntas);

// ===== TURNO =====
function mostrarTurno() {
    const jugador = estado.jugadores[estado.indiceJugador];
    estado.preguntas = estado.preguntasPorJugador[estado.indiceJugador];
    estado.indicePregunta = 0;
    estado.puntaje = 0;
    estado.correctas = 0;
    document.getElementById('turno-nombre').textContent = jugador.nombre;
    mostrarPantalla('turno');
}

document.getElementById('btn-empezar-turno').addEventListener('click', () => {
    mostrarPantalla('pregunta');
    mostrarPregunta();
});

// ===== PREGUNTA =====
function mostrarPregunta() {
    const p = estado.preguntas[estado.indicePregunta];
    const total = estado.preguntas.length;
    const jugador = estado.jugadores[estado.indiceJugador];

    document.getElementById('numero-pregunta').textContent = `Pregunta ${estado.indicePregunta + 1} de ${total}`;
    document.getElementById('jugador-actual-badge').textContent = `👤 ${jugador.nombre}`;
    document.getElementById('puntaje-actual').textContent = `⭐ ${estado.puntaje}`;
    document.getElementById('barra-relleno').style.width = `${(estado.indicePregunta / total) * 100}%`;
    document.getElementById('categoria-badge').textContent = p.categoria;
    document.getElementById('pregunta-texto').textContent = p.pregunta;

    const grid = document.getElementById('opciones-grid');
    grid.innerHTML = '';
    p.opciones.forEach((op, i) => {
        const btn = document.createElement('button');
        btn.className = 'btn-opcion';
        btn.innerHTML = `<span class="opcion-letra">${letras[i]}</span>${op}`;
        btn.addEventListener('click', () => responder(i, btn));
        grid.appendChild(btn);
    });

    iniciarTemporizador(nivelConfig[estado.nivel].tiempo);
}

// ===== TEMPORIZADOR =====
function iniciarTemporizador(segundos) {
    clearInterval(estado.intervalo);
    let restante = segundos;
    const el = document.getElementById('temporizador');
    const num = document.getElementById('tiempo-restante');

    const actualizar = () => {
        num.textContent = restante;
        el.classList.toggle('warning', restante <= Math.ceil(segundos * 0.5) && restante > Math.ceil(segundos * 0.25));
        el.classList.toggle('danger', restante <= Math.ceil(segundos * 0.25));
    };

    actualizar();
    estado.intervalo = setInterval(() => {
        restante--;
        actualizar();
        if (restante <= 0) tiempoAgotado();
    }, 1000);
}

// ===== RESPONDER =====
function responder(indice, btnSeleccionado) {
    clearInterval(estado.intervalo);
    const p = estado.preguntas[estado.indicePregunta];
    const btns = document.querySelectorAll('.btn-opcion');
    btns.forEach(b => b.disabled = true);

    if (indice === p.correcta) {
        btnSeleccionado.classList.add('correcta');
        estado.puntaje += nivelConfig[estado.nivel].puntos;
        estado.correctas += 1;
    } else {
        btnSeleccionado.classList.add('incorrecta');
        btns[p.correcta].classList.add('correcta');
    }

    setTimeout(siguientePregunta, 1200);
}

// ===== TIEMPO AGOTADO =====
function tiempoAgotado() {
    clearInterval(estado.intervalo);
    const btns = document.querySelectorAll('.btn-opcion');
    btns.forEach(b => b.disabled = true);
    btns[estado.preguntas[estado.indicePregunta].correcta].classList.add('correcta');
    setTimeout(siguientePregunta, 1200);
}

// ===== SIGUIENTE PREGUNTA =====
function siguientePregunta() {
    estado.indicePregunta++;
    estado.indicePregunta < estado.preguntas.length
        ? mostrarPregunta()
        : mostrarResultadoTurno();
}

// ===== RESULTADO DEL TURNO =====
function mostrarResultadoTurno() {
    const jugador = estado.jugadores[estado.indiceJugador];
    const incorrectas = estado.preguntas.length - estado.correctas;
    const porcentaje = Math.round((estado.correctas / estado.preguntas.length) * 100);

    jugador.puntaje = estado.puntaje;
    jugador.correctas = estado.correctas;
    jugador.total = estado.preguntas.length;

    const niveles = [
        { min: 90, emoji: '🏆', titulo: '¡Increíble!' },
        { min: 70, emoji: '🎉', titulo: '¡Muy bien!' },
        { min: 50, emoji: '👍', titulo: '¡Bien hecho!' },
        { min: 0, emoji: '💪', titulo: '¡A practicar!' }
    ];
    const nivel = niveles.find(n => porcentaje >= n.min);

    document.getElementById('resultado-turno-emoji').textContent = nivel.emoji;
    document.getElementById('resultado-turno-titulo').textContent = `${nivel.titulo} ${jugador.nombre}`;
    document.getElementById('puntaje-turno-num').textContent = estado.puntaje;
    document.getElementById('turno-correctas').textContent = estado.correctas;
    document.getElementById('turno-incorrectas').textContent = incorrectas;
    document.getElementById('turno-porcentaje').textContent = `${porcentaje}%`;

    const esUltimo = estado.indiceJugador === estado.jugadores.length - 1;
    const btnSig = document.getElementById('btn-siguiente-jugador');
    btnSig.innerHTML = esUltimo
        ? '<i class="bi bi-trophy"></i> Ver podio'
        : 'Siguiente jugador <i class="bi bi-arrow-right"></i>';

    mostrarPantalla('resultado-turno');
}

// ===== SIGUIENTE JUGADOR O PODIO =====
document.getElementById('btn-siguiente-jugador').addEventListener('click', () => {
    estado.indiceJugador++;
    estado.indiceJugador < estado.jugadores.length
        ? mostrarTurno()
        : mostrarPodio();
});

// ===== PODIO =====
function mostrarPodio() {
    const ordenados = [...estado.jugadores].sort((a, b) => b.puntaje - a.puntaje);
    const medallas = ['🥇', '🥈', '🥉', '4️⃣'];

    document.getElementById('podio-lista').innerHTML = ordenados.map((j, i) => `
    <div class="podio-item">
      <span class="podio-posicion">${medallas[i]}</span>
      <div>
        <p class="podio-nombre">${j.nombre}</p>
        <p class="podio-stats">${j.correctas}/${j.total} correctas</p>
      </div>
      <span class="podio-puntaje">${j.puntaje} pts</span>
    </div>
  `).join('');

    mostrarPantalla('podio');
}

// ===== JUGAR DE NUEVO / INICIO =====
document.getElementById('btn-jugar-de-nuevo').addEventListener('click', () => {
    estado.indiceJugador = 0;
    estado.jugadores.forEach(j => { j.puntaje = 0; j.correctas = 0; });
    cargarPreguntas();
});

document.getElementById('btn-volver-inicio').addEventListener('click', () => {
    document.getElementById('paso-jugadores').classList.remove('d-none');
    document.getElementById('paso-nombres').classList.add('d-none');
    document.getElementById('paso-nivel').classList.add('d-none');
    mostrarPantalla('inicio');
});