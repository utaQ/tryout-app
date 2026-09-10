const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', require('./routes/admin'));
app.use('/api', require('./routes/sessions'));
app.use('/api', require('./routes/uniforms'));
app.use('/api', require('./routes/players'));
app.use('/api', require('./routes/coaches'));
app.use('/api', require('./routes/evaluations'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Tryout app running at http://localhost:${PORT}`));
