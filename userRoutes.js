// import dependencies
const Joi = require('joi');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('./userModel');
const checkAuth = require('./check-auth');



// PROTECTED
// returns a list of all of the users
// /api/users
router.get('/users', checkAuth, (req, res, next) => {
    User.find()
    .select('-__v')
    .exec()
    .then(docs => {
        const response = {
            count: docs.length,
            users: docs
        };
        // return list of users
        res.status(200).json(response);
    })
    .catch(err => {
        console.log(err);
        res.status(500).json({
            error: err
        });
    });
});



// PROTECTED
// returns a user object if one exists, based of id
// /api/users/_id
router.get('/users/:id', checkAuth, (req, res, next) => {
    const id = req.params.id;
    User.findById(id)
    .select('-__v')
    .exec()
    .then(doc =>{
        if(doc){
            // if a user of this id exists
            res.status(200).json(doc);
        }else{
            // if a user of this id is not found
            res.status(404).json({
                message: ' No user found for this id.'
            });
        }
    })
    .catch(err => {
        console.log(err);
        res.status(500).json({error: err});
    });
});



// NOT PROTECTED
// register request, allows non existing users to register
// /api/users/register
router.post('/users/register', (req, res, next) => {
    User.find({username : req.body.username})
    .exec()
    .then(foundUser => {
        // if user of this username already exists
        if(foundUser.length >= 1){
            // code 409 - conflict
            return res.status(409).json({
                message : 'Username taken.'
            });
        }
        // if username isn't taken
        else{
             // create new object and assign attributes
             // hash password
            bcrypt.hash(req.body.password, 10, (err, hash)=>{
                if(err){
                    return res.status(500).json({
                        error : err
                    });
                }
                else{
                    // create new user object
                    const user = new User({
                        _id : new mongoose.Types.ObjectId(),
                        username : req.body.username,
                        password : hash
                    });
                    // save user to the database
                    user
                    .save()
                    .then(result =>{
                        // return user_id in response to client
                        res.status(201).json({
                            userId: result._id
                        });
                    })
                    .catch(err => {
                        console.log(err);
                        res.status(500).json({
                            error: err
                        });
                    });
                }
            });
        }
    });
});



// NOT PROTECTED
// login request - checks if there exists a user of matching username and password
// /api/users/login
router.post('/users/login', (req, res, next) => {
    User.find({ username : req.body.username})
    .exec()
    .then(user => {
        if(user.length < 1){
            // .find returns an array of users (should only ever be max length 1 as each user is unique)
            // if length < 1 --> no user found
            return res.status(401).json({
                message : 'Authentication failed.'
            });
        }
        // user found, compare hashed passwords
        bcrypt.compare(req.body.password, user[0].password, (err, result) =>{
            if(err){
                return res.status(401).json({
                    message : 'Authentication failed.'
                });
            }
            // if hashed passwords match, create a token and assign it to the user
            if(result){
                // token object
                const token = jwt.sign({
                    username : user[0].username,
                    userId : user[0]._id
                },
                // secret key for token creation
                '<key>',
                {
                // expiration timer
                    expiresIn : '1h'
                });
                // return token and user id upon successful login
                return res.status(201).json({
                    message : 'Authentication successful.',
                    token : token,
                    _id : user[0].id
                });
            }
            // error message if something went wrong
            // all error messages are the same for security reasons so potential attackers can't 
            // figure out where the login failed
            return res.status(401).json({
                message : 'Authentication failed.'
            });
        });
    })
    .catch(err => {
        console.log(err);
        res.status(500).json({
            error: err
        });
    });
});



// PROTECTED
// updates the activity array of a user on a specific day, based on date from request
// /api/users/_id
router.patch('/users/:id', checkAuth, (req, res, next)=> {
    const id = req.params.id;
    User.findOne({_id : id}, (err,user)=>{
        if(err){
            console.log(err);
            res.status(500).send();
        }else{
            // if user doesn't exist
            if(!user){
                res.status(404).send();
            }
            // if user found
            else{
                // date of day from request
                // ( the model is designed such that the array of days for a user will be in chronological order )
                const date = req.body.date;
                // data to be updated (the activity to be added)
                const data = {
                    type: req.body.type,
                    label: req.body.label,
                    duration: req.body.duration
                };
                // some input validation for duration to be a positive number etc
                const userInput = validateInput(data);
                if(userInput.error){
                    // error code 400 - bad request
                    res.status(400).json({
                        error : userInput.error.details[0].message
                    });
                    return;
                }
                // if the user has no previous inputs, and hence no day objects in db 
                var day_len = user.data.day.length;
                if(day_len === 0){
                    // create activity array for the day object
                    user.data.day = {activity:[]};
                    // asign date and activity to the day
                    user.data.day[0].date = date; 
                    user.data.day[0].activity[0] = data;
                }
                // else if there are previous inputs, ie existing day objects in db
                else if(day_len !== 0){
                    // length of activity array of last day in array
                    var activity_len = user.data.day[day_len-1].activity.length;
                    // if date from request matches that of the last day in the array
                    // update the activity array of that day
                    if(date === user.data.day[day_len-1].date){
                        user.data.day[day_len-1].activity[activity_len] = data;       
                    }
                    // else if date is more recent than last day in the array
                    // create a new day object and assign corresponding values
                    else if(date > user.data.day[day_len-1].date){
                        user.data.day[day_len] = {activity:[]};
                        user.data.day[day_len].date = date;
                        user.data.day[day_len].activity[0] = data;
                    }
                    // if date is from the past - throw error
                    // AS SUCH THE ARRAY WILL BE IN CHRONOLOGICAL ORDER
                    else if(date < user.data.day[day_len-1].date){
                        res.send('Cannot add activity for a day in the past. Please enter a valid date.');
                        return;
                    }
                }
            }
            user
            .save()
            .then(result =>{
                // return updated user in body of response to client
                res.status(201).json({
                    message : 'User updated.',
                    user: result
                });
            })
            .catch(err => {
                console.log(err);
                res.status(500).json({
                    error: err
                });
            });
        }
    });
});


// PROTECTED
// gives all activities for a given date
// /api/getDate/_id/date
router.put('/getDate/:id/:dateReq/', checkAuth, async function(req, res){
    const userId = req.params.id;
    const dateReq = req.params.dateReq;
    
    const userObj = await getFullUser(userId);
    var found = false;
    var i = 0;

    while ( i<userObj.data.day.length && found ==false){
        if (userObj.data.day[i].date == dateReq){
           const dayReturn =  userObj.data.day[i].activity;
           res.json(dayReturn);
           found == true;
        }
        i++;
    }
    res.json("None found");
});



// PROTECTED
// /api/users/_id
router.delete('/users/:id', checkAuth, (req, res, next) => {
    const id = req.params.id;
    User.deleteOne({_id: id})
    .exec()
    .then(result => {
        res.status(200).json({
            message : 'User deleted.'
        });
    })
    .catch(err => {
        console.log(err);
        res.status(500).json({
            error: err
        });
    });
});



// function to validate user input
// checks whether duration is a positive number less than 24, and if the required fields are there
function validateInput(data){
    const schema = {
        type : Joi.string().required(),
        label : Joi.string(),
        duration : Joi.number().min(1).less(24).required()
    };
    return Joi.validate(data, schema);
}


module.exports = router;