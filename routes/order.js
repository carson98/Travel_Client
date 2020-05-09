var express = require("express");
var router = express.Router();
var Tour = require("../models/tour");
var Cart = require("../models/cart");
var Coupon = require("../models/coupon");
var User = require("../models/user");
var sendMail = require("../config/sendMail");
var checkAuthen = require("../config/checkAuthenticate");
/* GET home page. */

router.get("/check-out", checkAuthen.isLoggedIn, function(req, res, next) {
  var successMsg = req.flash("success")[0];
  if (!req.session.cart) {
    return res.redirect("/cart/shopping-cart");
  }
  var cart = new Cart(req.session.cart);
  var errMsg = req.flash("error")[0];
  res.render("order/checkout", {
    total: cart.totalPrice,
    infoUser: req.session.user,
    tours: cart.generateArray(),
    discount: cart.coupons.description,
    totalDiscount: cart.totalDiscount,
    successMsg: successMsg,
    noMessage: !successMsg,
    errMsg: errMsg,
    noEror: !errMsg
  });
});

router.post("/checkout", function(req, res, next) {
  if (!req.session.cart) {
    return res.redirect("/cart/shopping-cart");
  }
  var cart = new Cart(req.session.cart);
  var stripe = require("stripe")("sk_test_7BfUxYUiVQhR4tBYOyuWkvEb00o6b5kLbO");

  stripe.charges.create(
    {
      amount: cart.totalPrice * 100,
      currency: "usd",
      source: req.body.stripeToken,
      description: "Test Charge"
    },
    function(err, charge) {
      if (err) {
        req.flash("error", err.message);
        return res.redirect("/checkout");
      }
      req.flash("success", "Successfully book tour!");
      req.session.cart = null;
      res.redirect("/");
    }
  );
});


// Add online payment
router.post("/online-order", async function(req, res, next) {
  var user = req.session.user; // session for information of user
  var cart = new Cart(req.session.cart); // session for cart
  var cartArr = cart.generateArray(); // parse to cart to array

  // create table for information table
  var infoPro = `<table class="table">
  <thead>
  <tr>
    <th>Tour Name</th>
    <th>Children</th>
    <th>Kid</th>
    <th>Quantity</th>
    <th>Tour Price</th>
    <th>Total Price</th>
  </tr>
  </thead>`;
  // end create table for information table

  var arrNum_order = [];
  var orderDate = new Date(); // create today to add orderDate
  // create stt for orderList in user-case
  var numberOrder_user = 0;
  var user_find = await User.findOne(
    {
      email: user.email
    },
    async (err, users) => {
      numberOrder_user = (await users.orderList.length) + 1;
    }
  );
  // end create stt for orderList in user-case
    console.log(cartArr.length)
  for (var i = 0; i < cartArr.length; i++) {
    var profit = 0;
    var NumberOrder = 0;
    var numberSeats = 0;
    var abc = 0;
    await Tour.findById(cartArr[i].item._id, async function(err, docs) {
      NumberOrder = (await docs.orderList.length) + 1; // create stt for orderList in tour
      numberSeats = Number(docs.seat) - Number(cartArr[i].totalNumber);
      console.log(cartArr[i].totalNumber);
      console.log(docs.seat);
      // process price after discount
      if (cart.coupons.description == 0) {
        abc = docs.totalProfit + cartArr[i].price;
        profit = cartArr[i].price;
      } else {
        abc = docs.totalProfit +
          cartArr[i].price - cartArr[i].price * cart.coupons.discount;
        profit = cartArr[i].price - cartArr[i].price * cart.coupons.discount;
      }
      // view price after discount

      // set coupon code inActive
      if (cart.coupons._id) {
        Coupon.findOneAndUpdate(
          {
            _id: cart.coupons._id
          },
          {
            $set: {
              active: false
            }
          },
          {
            upsert: true,
            new: true
          },
          (err, doc) => {}
        );
      }
      // end set coupon code inActive
    });

    // create object to add into tour -> orderList
    var objOrder = {
      orderDate: orderDate,
      totalQuantity: cartArr[i].qty,
      totalPrice: cartArr[i].price,
      numChil: cartArr[i].numChil,
      numKid: cartArr[i].numKid,
      couponCode: cart.coupons,
      totalHasDiscount: profit, // change cart.totalDiscount
      statusShip: "Not yet",
      userInfo: {
        name: user.fullName,
        email: user.email,
        phoneNum: user.phoneNum,
        address: req.body.address,
        district: req.body.district,
        city: req.body.city,
        country: req.body.country
      },
      status: req.body.card_name ? 1 : 0,
      numberOrder: NumberOrder
    };
    // end create object to add into tour -> orderList

    // add subOrder to user -> orderList
    await Tour.findOneAndUpdate(
      {
        _id: cartArr[i].item._id
      },
      {
        $addToSet: {
          orderList: objOrder
        },
        $set: {
          seat: Number(numberSeats),
          totalProfit: abc
        }
      },
      async (err, doc) => {
        // create object to add sub_order each tour id
        if (doc) {
          if (arrNum_order.length != 0) {
            var check = true;
            await arrNum_order.forEach(s => {
              if (s.proId == cartArr[i].item._id) {
                s.orderNumber.push(objOrder.numberOrder);
                check = false;
              }
            });
            if (check == true) {
              var obj = {
                proId: cartArr[i].item._id,
                orderNumber: []
              };
              await obj.orderNumber.push(objOrder.numberOrder);
              await arrNum_order.push(obj);
            }
          } else {
            var obj = {
              proId: cartArr[i].item._id,
              orderNumber: []
            };
            await obj.orderNumber.push(objOrder.numberOrder);
            await arrNum_order.push(obj);
          }
        }

        // create information of order to send mail
        infoPro += `
        <tbody>
        <tr>
          <td>${cartArr[i].item.title}</td>
          <td>${cartArr[i].numChil}</td>
          <td>${cartArr[i].numKid}</td>
          <td>${cartArr[i].qty}</td>
          <td>${cartArr[i].item.price}</td>
          <td>${cartArr[i].qty * cartArr[i].item.price}</td>
        </tr>`;
      }
    );
  }
  // add subOrder to user -> orderList
  var upd_user = await User.findOneAndUpdate(
    {
      email: user.email
    },
    {
      $addToSet: {
        orderList: {
          orderDate: orderDate,
          sub_order: arrNum_order,
          number: numberOrder_user,
          totalPrice: cart.totalDiscount
        }
      }
    },
    async (err, rs) => {}
  );
  // end add subOrder to user -> orderList

  // information to send mail
  var output =
    (await `
  <p>You have a new booking</p>
  <h3>Contact Details</h3>
  <ul>
    <li>Name: ${user.fullName}.</li>
    <li>Email: ${user.email}.</li>
    <li>Booking Date: ${new Date()}.</li>
    <li>Phone Number: ${user.phoneNum}.</li>
    <li>Address: ${req.body.address}, district ${req.body.district},${
      req.body.city
    }.</li>
    <li>Total Price Booking:$ ${cart.totalPrice}.00</li>
    <li>Discount Booking: ${cart.coupons.description}.</li>
    <li>Total Price:$ ${cart.totalDiscount}.</li>
  </ul>
`) +
    infoPro +
    `</tbody></table>` +
    `<h3>Total:$ ${cart.totalDiscount}.00</h3>`;
  // end send information to mail

  await sendMail(output, "Customer Order", user.email);
  req.session.cart = null; // set session cart null
  await res.render("contact/notification"); // render page
});





// Similar order
router.post("/add-order", async function(req, res, next) {
  var user = req.session.user; // session for information of user
  var cart = new Cart(req.session.cart); // session for cart
  var cartArr = cart.generateArray(); // parse to cart to array

  // create table for information table
  var infoPro = `<table class="table">
  <thead>
  <tr>
    <th nowrap>Tour Name</th>
    <th>Children</th>
    <th>Kid</th>
    <th nowrap>Tour Booked</th>
    <th nowrap>Tour Price</th>
  </tr>
  </thead>`;
  // end create table for information table

  var arrNum_order = [];
  var orderDate = new Date(); // create today to add orderDate
  // create stt for orderList in user-case
  var numberOrder_user = 0;
  var user_find = await User.findOne(
    {
      email: user.email
    },
    async (err, users) => {
      numberOrder_user = (await users.orderList.length) + 1;
    }
  );
  // end create stt for orderList in user-case

  for (var i = 0; i < cartArr.length; i++) {
    var profit = 0;
    var NumberOrder = 0;
    var numberSeats = 0;
    await Tour.findById(cartArr[i].item._id, async function(err, docs) {
      NumberOrder = (await docs.orderList.length) + 1; // create stt for orderList in tour
      numberSeats = Number(docs.seat) - Number(cartArr[i].totalNumber);

      // process price after discount
      if (cart.coupons.description == 0) {
        docs.totalProfit += cartArr[i].price;
        profit = cartArr[i].price;
      } else {
        docs.totalProfit +=
          cartArr[i].price - cartArr[i].price * cart.coupons.discount;
        profit = cartArr[i].price - cartArr[i].price * cart.coupons.discount;
      }
      // view price after discount
      // set coupon code inActive
      if (cart.coupons._id) {
        Coupon.findOneAndUpdate(
          {
            _id: cart.coupons._id
          },
          {
            $set: {
              active: false
            }
          },
          {
            upsert: true,
            new: true
          },
          (err, doc) => {}
        );
      }
      // end set coupon code inActive
    });

    // create object to add into tour -> orderList

    var objOrder = {
      orderDate: orderDate,
      totalQuantity: cartArr[i].qty,
      totalPrice: cartArr[i].price,
      numChil: cartArr[i].numChil,
      numKid: cartArr[i].numKid,
      couponCode: cart.coupons,
      totalHasDiscount: profit, // change cart.totalDiscount
      statusShip: "Not yet",
      userInfo: {
        name: user.fullName,
        email: user.email,
        phoneNum: user.phoneNum,
        address: req.body.address,
        district: req.body.district,
        city: req.body.city,
        country: req.body.country
      },
      status: req.body.card_name ? 1 : 0,
      numberOrder: NumberOrder
    };
    // end create object to add into tour -> orderList

    // add subOrder to user -> orderList
    await Tour.findOneAndUpdate(
      {
        _id: cartArr[i].item._id
      },
      {
        $addToSet: {
          orderList: objOrder
        },
        $set: {
          seat: Number(numberSeats)
        }
      },
      async (err, doc) => {
        // create object to add sub_order each tour id
        if (doc) {
          if (arrNum_order.length != 0) {
            var check = true;
            await arrNum_order.forEach(s => {
              if (s.proId == cartArr[i].item._id) {
                s.orderNumber.push(objOrder.numberOrder);
                check = false;
              }
            });
            if (check == true) {
              var obj = {
                proId: cartArr[i].item._id,
                orderNumber: []
              };
              await obj.orderNumber.push(objOrder.numberOrder);
              await arrNum_order.push(obj);
            }
          } else {
            var obj = {
              proId: cartArr[i].item._id,
              orderNumber: []
            };
            await obj.orderNumber.push(objOrder.numberOrder);
            await arrNum_order.push(obj);
          }
        }

        // create information of order to send mail
        infoPro += `
        <tbody>
        <tr>
          <td>${cartArr[i].item.title}</td>
          <td>${cartArr[i].numChil}</td>
          <td>${cartArr[i].numKid}</td>
          <td>${cartArr[i].qty}</td>
          <td>${cartArr[i].item.price}</td>
        </tr>`;
      }
    );
  }
  // add subOrder to user -> orderList
  var upd_user = await User.findOneAndUpdate(
    {
      email: user.email
    },
    {
      $addToSet: {
        orderList: {
          orderDate: orderDate,
          sub_order: arrNum_order,
          number: numberOrder_user,
          totalPrice: cart.totalDiscount
        }
      }
    },
    async (err, rs) => {}
  );
  // end add subOrder to user -> orderList

  // information to send mail
  var output =
    (await `
  <p>You have a new booking</p>
  <h3>Detail of Information</h3>
  <ul>
    <li>Name: ${user.fullName}.</li>
    <li>Email: ${user.email}.</li>
    <li>Booking Date: ${new Date()}.</li>
    <li>Phone Number: ${user.phoneNum}.</li>
    <li>Address: ${req.body.address}, district ${req.body.district},${
      req.body.city
    }.</li>
    <li>Total Price Booking:$ ${cart.totalPrice}.00</li>
    <li>Discount Booking: ${cart.coupons.description}.</li>
  </ul>
`) +
    infoPro +
    `</tbody></table>` +
    `<h3>Total Price:$ ${cart.totalDiscount}.00</h3>`;
  // end send information to mail

  await sendMail(output, "Customer Order", user.email);
  req.session.cart = null; // set session cart null
  await res.render("contact/notification"); // render page
});

module.exports = router;
