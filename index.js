
// import dependencies
const express = require('express');
const app = express();
const morgan = require('morgan');
const mongoose = require('mongoose');

// get rid of deprecation warning - from mongoose documentation
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

app.use(express.json());
app.use(morgan('dev'));

// mongodb setup
const path = ('<path>');

mongoose.connect(path,{ useNewUrlParser: true })
.then()
.catch( err => {
    console.log(err);
    process.exit(1);
});

const userRoutes = require('./userRoutes');
app.use("/api",userRoutes);


// PORT
// base - listening to port 80
// can be changed with 'export PORT= xxxx' 
const port = process.env.PORT || 80;
app.listen(port, ()=>{
    console.log(`listening on ${port}...`);
});

// error handler, if reached - no route before was entered
app.use((req, res, next)=>{
    const error = new Error('Route not found');
    console.log('ERROR : Route not found');
    error.status = 404;
    next(error);
});

// error handler
app.use((error, req, res, next)=>{
    // 500 error code for all other types of errors
    res.status(error.status || 500);
    res.json({
        error: {
            message: error.message
        }
    });
});
