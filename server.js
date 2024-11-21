const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = 3001;
const SECRET_KEY = 'tu_clave_secreta_aqui'; // En un entorno de producción, esto debería estar en una variable de entorno

// Middleware
app.use(express.json());
app.use(express.static('public')); // Servir archivos estáticos desde la carpeta 'public'

// Conexión a la base de datos SQLite
const db = new sqlite3.Database('./todo.sqlite', (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Crear tablas si no existen
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

    db.run(`CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    task TEXT,
    completed INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);
});

// Rutas de autenticación
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err) => {
            if (err) {
                res.status(400).json({ error: 'Username already exists' });
            } else {
                res.status(201).json({ message: 'User created successfully' });
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error creating user' });
    }
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            res.status(500).json({ error: 'Error logging in' });
        } else if (!user) {
            res.status(400).json({ error: 'User not found' });
        } else {
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
                res.json({ token });
            } else {
                res.status(400).json({ error: 'Invalid password' });
            }
        }
    });
});

// Middleware de autenticación
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Rutas CRUD para todos
app.post('/todos', authenticateToken, (req, res) => {
    const { task } = req.body;
    db.run('INSERT INTO todos (user_id, task) VALUES (?, ?)', [req.user.id, task], function(err) {
        if (err) {
            res.status(500).json({ error: 'Error creating todo' });
        } else {
            res.status(201).json({ id: this.lastID, task, completed: 0 });
        }
    });
});

app.get('/todos', authenticateToken, (req, res) => {
    db.all('SELECT * FROM todos WHERE user_id = ?', [req.user.id], (err, todos) => {
        if (err) {
            res.status(500).json({ error: 'Error fetching todos' });
        } else {
            res.json(todos);
        }
    });
});

app.put('/todos/:id', authenticateToken, (req, res) => {
    const { task, completed } = req.body;
    db.run('UPDATE todos SET task = ?, completed = ? WHERE id = ? AND user_id = ?',
        [task, completed, req.params.id, req.user.id],
        function(err) {
            if (err) {
                res.status(500).json({ error: 'Error updating todo' });
            } else if (this.changes === 0) {
                res.status(404).json({ error: 'Todo not found' });
            } else {
                res.json({ message: 'Todo updated successfully' });
            }
        }
    );
});

app.delete('/todos/:id', authenticateToken, (req, res) => {
    db.run('DELETE FROM todos WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function(err) {
        if (err) {
            res.status(500).json({ error: 'Error deleting todo' });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Todo not found' });
        } else {
            res.json({ message: 'Todo deleted successfully' });
        }
    });
});

// Ruta para visualizar el contenido de la base de datos (solo para desarrollo)
app.get('/debug/db', (req, res) => {
    const dbContent = {};

    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) {
            return res.status(500).json({ error: 'Error fetching tables' });
        }

        let completedQueries = 0;
        tables.forEach(table => {
            db.all(`SELECT * FROM ${table.name}`, [], (err, rows) => {
                if (err) {
                    return res.status(500).json({ error: `Error fetching data from ${table.name}` });
                }
                dbContent[table.name] = rows;
                completedQueries++;

                if (completedQueries === tables.length) {
                    res.json(dbContent);
                }
            });
        });
    });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});