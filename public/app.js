// Variables globales
let token = localStorage.getItem('token');

// Elementos del DOM
const authForms = document.getElementById('auth-forms');
const todoSection = document.getElementById('todo-section');
const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');

// Función para mostrar mensajes de error
function showError(message) {
    alert(message); // En una aplicación real, usa un método más elegante para mostrar errores
}

// Función para realizar solicitudes a la API
async function apiRequest(url, method, body) {
    const headers = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, {
            method,
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error('Error en la solicitud');
        }

        return await response.json();
    } catch (error) {
        showError(error.message);
    }
}

// Función para registrar un nuevo usuario
async function register(username, password) {
    const result = await apiRequest('/register', 'POST', { username, password });
    if (result && result.message) {
        alert('Usuario registrado con éxito. Por favor, inicia sesión.');
    }
}

// Función para iniciar sesión
async function login(username, password) {
    const result = await apiRequest('/login', 'POST', { username, password });
    if (result && result.token) {
        token = result.token;
        localStorage.setItem('token', token);
        showTodoSection();
    }
}

// Función para cerrar sesión
function logout() {
    token = null;
    localStorage.removeItem('token');
    authForms.classList.remove('hidden');
    todoSection.classList.add('hidden');
}

// Función para mostrar la sección de tareas
function showTodoSection() {
    authForms.classList.add('hidden');
    todoSection.classList.remove('hidden');
    loadTodos();
}

// Función para cargar las tareas del usuario
async function loadTodos() {
    const todos = await apiRequest('/todos', 'GET');
    if (todos) {
        todoList.innerHTML = '';
        todos.forEach(todo => addTodoToList(todo));
    }
}

// Función para agregar una tarea a la lista en el DOM
function addTodoToList(todo) {
    const li = document.createElement('li');
    li.className = 'flex items-center justify-between bg-gray-100 p-2 rounded';
    li.innerHTML = `
        <span class="${todo.completed ? 'line-through' : ''}">${todo.task}</span>
        <div>
            <button onclick="toggleTodo(${todo.id}, ${!todo.completed})" class="text-blue-500 hover:text-blue-700 mr-2">
                ${todo.completed ? 'Desmarcar' : 'Completar'}
            </button>
            <button onclick="deleteTodo(${todo.id})" class="text-red-500 hover:text-red-700">Eliminar</button>
        </div>
    `;
    todoList.appendChild(li);
}

// Función para crear una nueva tarea
async function createTodo(task) {
    const newTodo = await apiRequest('/todos', 'POST', { task });
    if (newTodo) {
        addTodoToList(newTodo);
    }
}

// Función para marcar/desmarcar una tarea como completada
async function toggleTodo(id, completed) {
    const result = await apiRequest(`/todos/${id}`, 'PUT', { completed });
    if (result) {
        loadTodos(); // Recargar la lista de tareas
    }
}

// Función para eliminar una tarea
async function deleteTodo(id) {
    const result = await apiRequest(`/todos/${id}`, 'DELETE');
    if (result) {
        loadTodos(); // Recargar la lista de tareas
    }
}

// Event Listeners
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    await register(username, password);
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    await login(username, password);
});

todoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const task = todoInput.value.trim();
    if (task) {
        await createTodo(task);
        todoInput.value = '';
    }
});

// Event Listener para cerrar sesión
document.getElementById('logout-button').addEventListener('click', logout);

// Verificar si el usuario ya está autenticado al cargar la página
if (token) {
    showTodoSection();
}