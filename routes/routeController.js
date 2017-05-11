var dotenv = require('dotenv');
dotenv.load();
const moment  = require('moment');
const express = require("express");
const routeController = express.Router();
const multer = require('multer');
var uploadPhoto = multer({
  dest: "./public/uploads/albumns"
});
var uploadTrack = multer({
  dest: "./public/uploads/tracks"
});
const Picture = require("../models/picture");

// User model
const User = require("../models/user");
const Wall = require("../models/wall");
const Route = require("../models/route");
const Message = require("../models/message");
const Albumn = require("../models/albumn");
const Track = require("../models/track");

const passport = require("passport");

const auth = require('../helpers/auth-helpers');
const googleHelper = require('../helpers/google-api');

/////////////////////////////FS FILES////////////////////////
const fs = require('fs');
const path = require('path');
let destDir = path.join(__dirname, '../public');
//////////////////////////////////////////////////////////////

routeController.get('/routes/new', auth.ensureLoggedIn('/login'), (req, res, next) => {
  res.render('intranet/routes/new');
});

routeController.post('/routes/new',auth.ensureLoggedIn('/login'),(req, res, next)=>{

  const name = req.body.name;
  const ubication = req.body.ubication;
  const date = req.body.date;
  const description = req.body.description;

  if (name === "" || ubication === ""|| date === ""||description === "" ) {
    res.render("intranet/routes/edit",{route}, {
      message: "Indicate name, ubication, date and description"
    });
    return;
  }

  let data = {
    event:{
      'summary': req.body.name,
      'location': req.body.ubication,
      'start':{
        'date': req.body.date
      },
      'end':{
        'date': req.body.date
      }
    },
    calendarId: process.env.CALENDAR_ID,
  };
  googleHelper.insertEventHelper(data,(err,event)=>{
    if(err){
      return next(err);
    }

    let newRoute= {
      name:req.body.name,
      ubication: req.body.ubication,
      date:req.body.date,
      description:req.body.description,
      owner_id: req.user.id,
      comments:[],
      albumn: undefined,
      track:undefined,
      eventId: event.id
    };
    Route.create(newRoute,(err, route)=>{
      if(err){
        return next(err);
      }
      let newAlbumn={
        title: route.name,
        pictures:[],
        route_id: route._id,
        owner_id: route.owner_id,
      };
      Albumn.create(newAlbumn, (err, albumn)=>{
        if(err){
          return next(err);
        }
        route.albumn = albumn._id;
        route.save((err, routeUpdated)=>{
          if(err){
            return next(err);
          }
          req.user.routes.push(route);
          req.user.albumns.push(albumn);
          req.user.save((err,userUpdated)=>{
            if(err){
              return next(err);
            }

            Wall.findOne({wallType: 'GLOBAL'}, (err, wall) => {
              if (err){
                return next(err);
              }

              let newMessage = {
                message: `${newRoute.name} para la fecha ${newRoute.date} con ubicacion ${newRoute.ubication}`,
                owner_name: req.user.username,
                owner_id: req.user.id,
                routeOwner_id: route._id,
                dest_id: undefined,
                wall_id: wall._id,
                messageType: "ROUTE_GLOBAL"
              };

              Message.create(newMessage, (err, message) => {
                if (err) {
                  return next(err);
                }
                wall.messages.push(message);
                wall.save((err, updatedWall) => {
                  if (err) {
                    throw err;
                  }
                  res.redirect('/routes/'+ route._id+ '/show');
                  // res.redirect('/main');
                });
              });
            });
          });
        });
      });
    });
  });
});

routeController.get('/routes/index',auth.ensureLoggedIn('/login'),(req, res, next)=>{
  Route.find({}, (err,routes)=>{
    if(err){
      next(err);
    }
    res.render('intranet/routes/index',{routes:routes});
  });
});

routeController.get('/routes/:route_id/show',auth.ensureLoggedIn('/login'), (req,res,next)=>{
  let routeQuery=[{path: "comments"},{path: "albumn"},{path: "track"}];
  Route.findById({_id: req.params.route_id}).populate(routeQuery).exec((err,route)=>{
    if (err){
      next (err);
    }
    res.render("intranet/routes/show",{route: route, key: process.env.GOOGLE_KEY});
  });
});

routeController.get('/routes/:route_id/edit',auth.ensureLoggedIn('/login'), (req,res,next)=>{
  Route.findById({_id: req.params.route_id}).populate("track").exec((err,route)=>{
    if (err){
      next (err);
     }
     else{
       console.log("route",route);
       res.render("intranet/routes/edit",{route: route, key: process.env.GOOGLE_KEY});
     }
  });
});

routeController.post('/routes/:route_id/edit',auth.ensureLoggedIn('/login'), (req,res,next)=>{

  const name = req.body.name;
  const ubication = req.body.ubication;
  const date = req.body.date;
  const description = req.body.description;

  if (name === "" || ubication === ""|| date === ""||description === "" ) {
    res.render("intranet/routes/edit",{route}, {
      message: "Indicate name, ubication, date and description"
    });
    return;
  }

  let editedRoute={
    name       :name,
    ubication  :ubication,
    date       :date,
    description:description
  };

  Route.findByIdAndUpdate({_id:req.params.route_id},editedRoute,{new:true}, (err, route)=>{
    if(err){
      next(err);
    }
    let data = {
      event:{
        'summary': req.body.name,
        'location': req.body.ubication,
        'start':{
          'date': req.body.date
        },
        'end':{
          'date': req.body.date
        }
      },
      eventId: route.eventId,
      calendarId: process.env.CALENDAR_ID,
    };
    googleHelper.updateEventHelper(data,(err,event)=>{
      if(err){
        return next(err);
      }

      Wall.findOne({wallType: 'GLOBAL'}, (err, wall) => {
        if (err){
          return next(err);
        }
        let editMessage = {
          message: `${editedRoute.name} para la fecha ${editedRoute.date} con ubicacion ${editedRoute.ubication}`,
        };
        Message.findOneAndUpdate({routeOwner_id:route._id },editMessage, (err, message) => {
          if (err) {
            return next(err);
          }
          wall.save((err, updatedWall) => {
            if (err) {
              throw err;
            }
            Track.populate(route,{path: 'track'},(err,routeTrack)=>{
              res.render('intranet/routes/edit',{route: routeTrack , message: "Route Edited", key: process.env.GOOGLE_KEY});
              // res.redirect('/'+req.user.username+'/profile');
            });
          });
        });
      });
    });
  });
 });
//not good with async
routeController.post('/routes/:route_id/delete',auth.ensureLoggedIn('/login'), (req,res,next)=>{
  console.log("hi");
  Route.findByIdAndRemove({_id:req.params.route_id},(err,route)=>{
    if(err){
      return next(err);
    }else{

      let data = {
        eventId: route.eventId,
        calendarId: process.env.CALENDAR_ID,
      };

      googleHelper.deleteEventHelper(data,(err,event)=>{
        if(err){
          return next(err);
        }
        Message.findOneAndRemove({routeOwner_id:route._id },(err,message)=>{
          if(err){
            return next(err);
          }
          Wall.findByIdAndUpdate({_id:message.wall_id},  {'$pull': {'messages': message._id }},{new:true},(err,wall)=>{
            if(err){
              return next(err);
            }
            Message.deleteMany({route_id:route._id},(err)=>{
              if(err){
                return next(err);
              }else{
                Albumn.findOneAndRemove({route_id:route._id},(err,albumn)=>{
                  if(err){
                    return next(err);
                  }else{
                    Picture.find({albumn_id: albumn._id},(err,pictures)=>{
                      if(err){
                        return next(err);
                      }else{
                        if(pictures!==null){
                          pictures.forEach((picture)=>{
                            fs.unlink(path.join(destDir, picture.pic_path), (err)=>{
                              if(err){
                                return next(err);
                              }else{
                                picture.remove((err)=>{
                                  if(err){
                                    return next(err);
                                  }
                                });
                              }
                            });
                          });
                        }
                        Track.findOneAndRemove({route_id:route._id},(err,track)=>{
                          if(err){
                            return next(err);
                          }else{
                            if(track!==null)
                            {
                              fs.unlink(path.join(destDir, track.file_path), (err)=>{
                                if(err){
                                  return next(err);
                                }else{
                                  User.findOneAndUpdate({_id:route.owner_id},{'$pull': {'routes': route._id, 'albumns': albumn._id,'tracks': track._id  }},{new:true},(err,user)=>{
                                    if(err){
                                      return next(err);
                                    }else{
                                      return res.redirect(`/profile/${user._id}/show`);
                                    }
                                  });
                                }
                              });
                            }else{
                              User.findOneAndUpdate({_id:route.owner_id},{'$pull': {'routes': route._id, 'albumns': albumn._id}},{new:true},(err,user)=>{
                                if(err){
                                  return next(err);
                                }
                                else{
                                  return res.redirect(`/profile/${user._id}/show`);
                                }
                              });
                            }
                          }
                        });
                      }
                    });
                  }
                });
              }
            });
          });
        });
      });
    }
  });
});

routeController.post('/routes/:route_id/comments/new',auth.ensureLoggedIn('/login'), (req,res,next)=>{
  Route.findById({_id: req.params.route_id}, (err,route)=>{
    if(err){
      next(err);
    }
    let newComment ={
      message:req.body.comment,
      owner_username: req.user.username,
      owner_id: req.user.id,
      dest_id: route.owner_id,
      route_id: req.params.route_id,
      messageType: "ROUTE"
    };

    Message.create(newComment, (err, comment) => {
      if (err) {
        next(err);
      }else{
        route.comments.push(comment);
        route.save((err, updatedRoute) => {
          if (err) {
            next (err);
          }else{
            return res.redirect('/routes/'+ updatedRoute._id +'/show');
          }
        });
      }
    });
  });
});

routeController.post('/routes/:route_id/tracks/new', uploadTrack.single("track"),(req,res,next)=>{

  Route.findById({_id: req.params.route_id}).populate("tracks").exec((err,route)=>{
    if(err){
      next(err);
    }
    if(req.file!== undefined){

      if(route.track===undefined){
        let newTrack = new Track({
          name: route.name,
          file_path: `/uploads/tracks/${req.file.filename}`,
          file_codename: req.file.filename,
          file_name: req.file.originalname,
          route_id : route._id,
          owner_id : route.owner_id
        });

        newTrack.save((err,track)=>{
          if(err){
            next(err);
          }
          route.track = track._id;

          route.save((err,routeUpdated)=>{
            if(err){
              next(err);
            }
            User.findById({_id:route.owner_id},(err,user)=>{
              user.tracks.push(track);
              user.save((err)=>{
                if(err){
                  next(err);
                }
                Track.populate(routeUpdated,{path: 'track'},(err,routeTrack)=>{
                  res.render('intranet/routes/edit',{route: routeTrack, key: process.env.GOOGLE_KEY});
                });
              });
            });
          });
        });
      }else{
        fs.unlink(path.join(destDir, route.track.file_path), (err)=>{
          if(err){
            next(err);
          }
          else {

            let newTrack = new Track({
              name: route.name,
              file_path: `/uploads/tracks/${req.file.filename}`,
              file_codename: req.file.filename,
              file_name: req.file.originalname,
              route_id : route._id,
              owner_id : route.owner_id,
              _id: route.track._id
            });

            Track.findByIdAndUpdate({_id:routeTrack.track._id}, newTrack ,{new:true}, (err,track)=>{
              if(err){
                next(err);
              }
              route.track = track._id;
              route.save((err,routeUpdated)=>{
                if(err){
                  next(err);
                }
                //User.findByIdAndUpdate({_id: track.owner_id},{'$pull': {'tracks':{ '_id': track._id }}},(err,userUpdated)=>{
                User.findByIdAndUpdate({_id: track.owner_id},{'$pull': {'tracks': track._id }},(err,userUpdated)=>{
                  if(err){
                    next(err);
                  }
                  userUpdated.tracks.push(track);
                  userUpdated.save((err)=>{
                    if(err){
                      next(err);
                    }
                    res.render('intranet/routes/edit',{route: routeUpdated, key: process.env.GOOGLE_KEY});
                  });
                });
              });
            });
          }
        });
      }
    }else {
      console.log("hiiiiii-------------------------------");
      res.render('intranet/routes/edit',{route: route, key: process.env.GOOGLE_KEY});
    }
  });
});

routeController.post('/routes/:route_id/tracks/:track_id/delete', uploadTrack.single("track"),(req,res,next)=>{
  console.log("hi1");
  Route.findByIdAndUpdate({_id: req.params.route_id}, { $unset: { track: ""} },{new:true},(err,routeUpdated)=>{
    if(err){
      next(err);
    }
    else{
      Track.findByIdAndRemove({_id: req.params.track_id},(err,track)=>{
        if(err){
          next(err);
        }
        else{
          fs.unlink(path.join(destDir, track.file_path), (err)=>{
            if(err){
              next(err);
            }
            else{
              User.findByIdAndUpdate({_id:track.owner_id},{'$pull': {'tracks': track._id }},(err,userUpdated)=>{
                res.render('intranet/routes/edit',{route: routeUpdated, key: process.env.GOOGLE_KEY});
              });
            }
          });
        }
      });
    }
  });
});

routeController.get('/routes/:route_id/albumns/:albumn_id/show',auth.ensureLoggedIn('/login'),(req,res, next)=>{
  Albumn.findById({_id: req.params.albumn_id}).populate("pictures").exec((err,albumn)=>{
    if(err){
      next(err);
    }
    else{
      res.render('intranet/albumns/show',{albumn});
    }
  });
});

routeController.get('/routes/:route_id/albumns/:albumn_id/edit',auth.ensureLoggedIn('/login'),(req,res, next)=>{
  Albumn.findById({_id: req.params.albumn_id}).populate("pictures").exec((err,albumn)=>{
    if(err){
      next(err);
    }
    else{
      res.render('intranet/albumns/edit',{albumn});
    }
  });
});

routeController.get('/routes/:route_id/albumns/:albumn_id/pictures/:picture_id/delete',auth.ensureLoggedIn('/login'),(req,res, next)=>{
  console.log("req.params.picture_id",req.params.picture_id);
  //Albumn.findByIdAndUpdate({_id: req.params.albumn_id},{'$pull': {'pictures':{ '_id': req.params.picture_id }}},(err,albumn)=>{
  Albumn.findByIdAndUpdate({_id: req.params.albumn_id},{'$pull': {'pictures': req.params.picture_id }},{new:true},(err,albumn)=>{
    if(err){
      next(err);
    }
    else{
      Picture.findById({_id: req.params.picture_id},(err,picture)=>{
        if(err){
          next(err);
        }
        fs.unlink(path.join(destDir, picture.pic_path), (err)=>{
          if(err){
              next(err);
            }
            else {
              picture.remove((err, pictureRemoved)=>{
                if(err){
                  next(err);
                }
                Picture.populate(albumn,{path:'pictures'},(err,albumnPictures)=>{
                  if(err){
                    next(err);
                  }
                  res.render('intranet/albumns/edit',{albumn:albumnPictures});
                });
              });
            }
        });
      });
    }
  });
});

routeController.post('/routes/:route_id/albumns/:albumn_id/pictures/upload', uploadPhoto.single('photo'), (req, res, next)=>{
  Albumn.findById({_id: req.params.albumn_id}, (err,albumn)=>{
    if(err){
      next(err);
    }
    if(req.file!== undefined){
      let newPicture = new Picture({
        name: req.body.name,
        pictureType: 'ALBUMN',
        albumn_id: albumn._id,
        route_id: albumn.route_id,
        owner_id: albumn.owner_id,
        pic_path: `/uploads/albumns/${req.file.filename}`,
        pic_name: req.file.originalname
      });
      newPicture.save((err,picture) => {
        albumn.pictures.push(picture);
        albumn.save((err, albumnUpdated)=>{
          if(err){
            next(err);
          }
          Picture.populate(albumnUpdated,{path:"pictures"},(err,albumnPictures)=>{
            if(err){
              next(err);
            }
            res.render('intranet/albumns/edit',{albumn: albumnPictures});
          });
        });
      });
    }
    else {
      Picture.populate(albumn,{path:"pictures"},(err,albumnPictures)=>{
        if(err){
          next(err);
        }
        res.render('intranet/albumns/edit',{albumn: albumnPictures});
      });
    }
  });
});

module.exports= routeController;
