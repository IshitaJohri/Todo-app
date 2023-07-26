const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

app.use(methodOverride('_method'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.set('view engine', 'ejs');

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

mongoose.connect('mongodb://127.0.0.1:27017/tododb', { useNewUrlParser: true, useUnifiedTopology: true, connectTimeoutMS: 90000 })
  .then(() => console.log('Connected to MongoDB'))
  .catch(error => console.error(error));

const todoSchema = new mongoose.Schema({
    task: String,
    description: String,
    completed: Boolean,
    username: String,
    createdAt: {
        type: Date,
        default: Date.now 
      }
});

const Todo = mongoose.model('Todo', todoSchema);

const userSchema = new mongoose.Schema({
  username: String,
  password: String, 
  todos: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Todo'
    }
  ]
});

const User = mongoose.model('User', userSchema);

const jwtSecret = 'your-secret-key';

const protectLoggedInUser = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
};

const protectAdminPage = (req, res, next) => {
    const token = req.session.token;
  
    if (!token) {
      res.redirect('/login');
      return;
    }
  
    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.user = decoded;
      next();
    } catch (error) {
      console.error(error);
      res.redirect('/login');
    }
  };

// User Registration
{
    app.get('/login', (req, res) => {
    res.render('login');
  });

  app.get('/adminlogin', (req, res) => {
    res.render('adminlogin');
  });

  app.get('/admin', (req, res) => {
    res.render('admin');
  });

app.get('/register', (req, res) => {
    res.render('register');
});
}

app.post('/register', (req, res) => {
  const { username, password } = req.body;

  User.findOne({ username })
    .then(user => {
      if (user) {
        res.send('Username already exists. Please choose a different username.');
      } else {
        User.create({ username, password, todos: [] })
          .then(newUser => {
            console.log('User registered successfully');
            res.redirect('/login');
          })
          .catch(error => {
            console.error(error);
            res.send('An error occurred while registering the user');
          });
      }
    })
    .catch(error => {
      console.error(error);
      res.send('An error occurred while checking the username');
    });
});

// User Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  User.findOne({ username, password })
    .then(user => {
      if (!user) {
        res.send('Invalid credentials. Please try again.');
      } else {
        req.session.userId = user._id;
        req.session.username= user.username;
        res.redirect('/');
      }
    })
    .catch(error => {
      console.error(error);
      res.send('An error occurred while logging in');
    });
});

// Create a new todo for the currently logged-in user
app.post('/todo', protectLoggedInUser, (req, res) => {
    const task= req.body.task;
    const description= req.body.description;
    const userId = req.session.userId;
    const username = req.session.username;
  console.log(req.session);
    User.findById(userId)
      .then(user => {
        if (!user) {
          res.send('User not found.');
        } else {
          Todo.create({ task, description, completed: false, username: username })
            .then(newTodo => {
              user.todos.push(newTodo);
              user.save();
              console.log('Todo saved');
              res.redirect('/');
            })
            .catch(error => {
              console.error(error);
              res.send('An error occurred while saving the todo');
            });
        }
      })
      .catch(error => {
        console.error(error);
        res.send('An error occurred while retrieving user information');
      });
  });
  

// View user-specific todos on the homepage
app.get('/', protectLoggedInUser, (req, res) => {
    const userId = req.session.userId;
    const username = req.session.username;
    User.findById(userId)
      .populate('todos')
      .then(user => {
        res.render('index', { todos: user.todos });
      })
      .catch(error => {
        console.error(error);
        res.send('An error occurred while retrieving todos');
      });
  });

  app.put('/todo/:id', protectLoggedInUser, (req, res) => {
    const todoId = req.params.id;
    const { completed } = req.body;
    
  
    Todo.findByIdAndUpdate(todoId, { completed })
      .then(() => {
        console.log('Todo updated');
        res.redirect('/');
      })
      .catch(error => {
        console.error(error);
        res.send('An error occurred while updating the todo');
      });
  });

  app.delete('/todo/:id', protectLoggedInUser, (req, res) => {
    const todoId = req.params.id;
  
    Todo.findByIdAndDelete(todoId)
      .then(() => {
        console.log('Todo deleted');
        res.redirect('/');
      })
      .catch(error => {
        console.error(error);
        res.send('An error occurred while deleting the todo');
      });
  });
  

// View user-specific todos on the admin page
app.get('/admin/Todolist', protectAdminPage, (req, res) => {
    
    Todo.find()
      .then(Todos => {
        res.render('admin_tl', { Todos });

        console.log(Todos);
      })
      .catch(error => {
        console.error(error);
        res.send('An error occurred while retrieving users and their todos');
      });
  });

app.get('/admin/Userlist', protectAdminPage, (req, res) => {

    User.find()
    .then(Users=> {
    res.render('admin_ul', { Users });
    console.log(Users);
    })
    .catch(error => {
    console.error(error);
    res.send('An error occurred while retrieving users and their todos');
    });
});

  app.delete('/admin/delete/:username', protectAdminPage, (req, res) => {
    const username = req.params.username;
  
    User.findOneAndDelete({ username: username })
      .then(() => {
        res.redirect('/admin/Userlist');
      })
      .catch(error => {
        console.error(error);
        res.send('An error occurred while deleting the user');
      });
  });
  
  app.delete('/admin/deletet/:_id', protectAdminPage, (req, res) => {
    Todo.findOneAndDelete({ _id : req.params._id })
      .then(() => {
        res.redirect('/admin/Todolist');
      })
      .catch(error => {
        console.error(error);
        res.send('An error occurred while deleting the user');
      });
  });

  app.post('/adminlogin', (req, res) => {
    const { username, password } = req.body;
  
    if (username === 'admin' && password === 'pass') {
      const payload = { username };
      const token = jwt.sign(payload, jwtSecret, { expiresIn: '1h' });
  
      req.session.token = token;
      res.redirect('/admin');
    } else {
      const errorMessage = 'Invalid credentials. Please try again.';
      res.render('login', { error: errorMessage });
      
    }
  });

app.listen(port, () => console.log(`Server is running on port ${port}`));
