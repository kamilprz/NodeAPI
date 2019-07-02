
// user model for the database, a user will have a data array
// data arary consists of an array of day objects
// day object consits of corresponding date, and an array of activities for that day
// activity object has type, label and duration properties

const mongoose = require('mongoose');
const userSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,

    username: {type: String, required : true, unique : true},
    password: {type: String, required : true},
    data: {
        index: false,
        day: [{
            index: false,
            date: String,
            activity: [{
                _id : false,
                type: {type: String, required : true},
                label: String,
                duration: {type: Number, required : true}
            }]
        }],
    },
});

module.exports = mongoose.model('User', userSchema);
