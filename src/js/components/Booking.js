import {classNames, select, settings, templates} from '../settings.js';
import utils from '../utils.js';
import AmountWidget from '../components/AmountWidget.js';
import DatePicker from './DatePicker.js';
import HourPicker from './HourPicker.js';

class Booking{
  constructor(element){
    const thisBooking = this;

    thisBooking.render(element);
    thisBooking.initWidgets();
    thisBooking.getDate();

    
    thisBooking.starters = [];
  }

  getDate(){
    const thisBooking = this;

    const startDateParam = settings.db.dateStartParamKey + '=' + utils.dateToStr(thisBooking.datePickerElem.minDate);
    const endDateParam = settings.db.dateEndParamKey + '=' + utils.dateToStr(thisBooking.datePickerElem.maxDate);

    const params = {
      booking : [
        startDateParam,
        endDateParam,
      ],
      eventsCurrent: [
        settings.db.notRepeatParam,
        startDateParam,
        endDateParam,
      ],
      eventsRepeat: [
        settings.db.repeatParam,
        endDateParam,
      ],
    };

    //console.log('getData params', params);

    const urls = {
      booking:       settings.db.url + '/' + settings.db.booking 
                                     + '?' + params.booking.join('&'),
      eventsCurrent: settings.db.url + '/' + settings.db.event   
                                     + '?' + params.eventsCurrent.join('&'),
      eventsRepeat:  settings.db.url + '/' + settings.db.event   
                                     + '?' + params.eventsRepeat.join('&'),
    };
    // console.log('getData urls', urls);

    Promise.all([
      fetch(urls.booking),
      fetch(urls.eventsCurrent),
      fetch(urls.eventsRepeat),
    ])
      .then(function(allResponses){
        const bookingsResponse = allResponses[0];
        const eventsCurrentResponse = allResponses[1];
        const eventsRepeatResponse = allResponses[2];
        return Promise.all([
          bookingsResponse.json(),
          eventsCurrentResponse.json(),
          eventsRepeatResponse.json(),
        ]);
      })
      .then(function([bookings, eventsCurrent, eventsRepeat]){
        // console.log(bookings);
        // console.log(eventsCurrent);
        // console.log(eventsRepeat);
        thisBooking.parseData(bookings, eventsCurrent, eventsRepeat);
      });
  }

  parseData(bookings, eventsCurrent, eventsRepeat){
    const thisBooking = this;

    thisBooking.booked = {};

    for(let item of bookings){
      thisBooking.makedBooked(item.date, item.hour, item.duration, item.table);
    }

    for(let item of eventsCurrent){
      thisBooking.makedBooked(item.date, item.hour, item.duration, item.table);
    }

    const minDate = thisBooking.datePickerElem.minDate;
    const maxDate = thisBooking.datePickerElem.maxDate;

    for(let item of eventsRepeat){
      if(item.repeat == 'daily'){
        for(let loopDate = minDate; loopDate <= maxDate; loopDate = utils.addDays(loopDate, 1)){
          thisBooking.makedBooked(utils.dateToStr(loopDate), item.hour, item.duration, item.table);
        }
      }
    }
    // console.log('thisBooking.booked:', thisBooking.booked);

    thisBooking.updateDOM();
  }

  makedBooked(date, hour, duration, table){
    const thisBooking = this;

    if(typeof thisBooking.booked[date] == 'undefined'){
      thisBooking.booked[date] = {};
    }

    const startHour = utils.hourToNumber(hour);

    for(let hourBlock = startHour; hourBlock < startHour + duration; hourBlock += 0.5){
      //console.log('loop', hourBlock);

      if(typeof thisBooking.booked[date][hourBlock] == 'undefined'){
        thisBooking.booked[date][hourBlock] = [];
      }

      thisBooking.booked[date][hourBlock].push(table);
    }
  }

  updateDOM(){
    const thisBooking = this;

    thisBooking.date = thisBooking.datePickerElem.value;
    thisBooking.hour = utils.hourToNumber(thisBooking.hourPickerElem.value);

    let allAvailable = false;

    if(
      typeof thisBooking.booked[thisBooking.date] == 'undefined'
      ||
      typeof thisBooking.booked[thisBooking.date][thisBooking.hour] == 'undefined'
    ){
      allAvailable = true;
    }

    for(let table of thisBooking.dom.tables){
      let tableId = table.getAttribute(settings.booking.tableIdAttribute);
      if(!isNaN(tableId)){
        tableId = parseInt(tableId);
      }

      if(
        !allAvailable
        &&
        thisBooking.booked[thisBooking.date][thisBooking.hour].includes(tableId) >=1
      ){
        table.classList.add(classNames.booking.tableBooked);
      } else {
        table.classList.remove(classNames.booking.tableBooked);
      }
    }
  }

  render(element){
    const thisBooking = this;

    const generatedHTML = templates.bookingWidget();

    thisBooking.dom = {};

    thisBooking.dom.wrapper = element;

    thisBooking.dom.wrapper.innerHTML = generatedHTML;

    thisBooking.dom.peopleAmount = thisBooking.dom.wrapper.querySelector(select.booking.peopleAmount);
    thisBooking.dom.hoursAmount = thisBooking.dom.wrapper.querySelector(select.booking.hoursAmount);

    thisBooking.dom.datePickerInput = thisBooking.dom.wrapper.querySelector(select.widgets.datePicker.wrapper);
    thisBooking.dom.hourPickerInput = thisBooking.dom.wrapper.querySelector(select.widgets.hourPicker.wrapper);

    thisBooking.dom.tables = thisBooking.dom.wrapper.querySelectorAll(select.booking.tables);
    thisBooking.dom.floor = thisBooking.dom.wrapper.querySelector(select.booking.floor);
    thisBooking.dom.phone = thisBooking.dom.wrapper.querySelector(select.booking.phone);
    thisBooking.dom.address = thisBooking.dom.wrapper.querySelector(select.booking.address);
    thisBooking.dom.form = thisBooking.dom.wrapper.querySelector(select.booking.form);
    thisBooking.dom.submit = thisBooking.dom.wrapper.querySelector(select.booking.submit);
    thisBooking.dom.starters = thisBooking.dom.wrapper.querySelector(select.booking.starters);
  }

  initWidgets(){
    const thisBooking = this;

    thisBooking.peopleAmount = new AmountWidget(thisBooking.dom.peopleAmount);
    thisBooking.hoursAmount = new AmountWidget(thisBooking.dom.hoursAmount);

    thisBooking.datePickerElem = new DatePicker(thisBooking.dom.datePickerInput); 
    thisBooking.hourPickerElem = new HourPicker(thisBooking.dom.hourPickerInput);


    thisBooking.dom.floor.addEventListener('click', function(event){
      const clickedElement = event.target;
      if (clickedElement.classList.contains('table'))
        thisBooking.initTables(clickedElement);
    });

    thisBooking.dom.submit.addEventListener('click', function (event) {
      event.preventDefault();
      thisBooking.sendBooking();
    });

    thisBooking.dom.form.addEventListener('submit', function(event){
      event.preventDefault();
      thisBooking.sendBooking();
    });

    thisBooking.dom.starters.addEventListener('click', function(event){
      const starter = event.target;

      if(
        starter.getAttribute('type') === 'checkbox' && 
        starter.getAttribute('name') === 'starter')
      {
        if(starter.checked){
          thisBooking.starters.push(starter.value);          
        } else if (!starter.checked){
          const starterId = thisBooking.starters.indexOf(starter.value);
          thisBooking.starters.splice(starterId, 1);
        }        
      }      
    }); 
  }

  initTables(clickedElement) {
    const thisBooking = this;

    thisBooking.dom.wrapper.addEventListener('updated', function(){
      thisBooking.selectedTable = null;
      const tableSelected = thisBooking.dom.floor.querySelector(select.booking.tableSelected);
      if (tableSelected) { tableSelected.classList.remove('selected'); }
    });
    
    const tableId = clickedElement.getAttribute(settings.booking.tableIdAttribute);

    if (clickedElement.classList.contains('booked')) {
      alert('STOLIK JEST ZAJĘTY!');
    }
    else {const tableSelected = thisBooking.dom.floor.querySelector(select.booking.tableSelected);
      if (tableSelected && tableSelected != clickedElement) { tableSelected.classList.remove('selected'); }
      if (clickedElement.classList.contains('selected')) {
        clickedElement.classList.remove('selected');
        thisBooking.selectedTable = null;
      } else {
        clickedElement.classList.add('selected');
        thisBooking.selectedTable = tableId;
      }
    }
  }

  sendBooking(){
    const thisBooking = this;

    const url = settings.db.url + '/' + settings.db.booking;

    const payload = {
      date: thisBooking.datePickerElem.value,    //data wybrana w datePickerze
      hour: thisBooking.hourPickerElem.value,    //godzina wybrana w hourPickerze (w formacie HH:ss)
      table: thisBooking.selectedTable,          //numer wybranego stolika (lub null jeśli nic nie wybrano)
      duration: thisBooking.hoursAmount.value,   //liczba godzin wybrana przez klienta
      ppl: thisBooking.peopleAmount.value,       //liczba osób wybrana przez klienta
      starters: thisBooking.starters,            //tablica ['bread', 'water']
      phone: thisBooking.dom.phone.value,        //numer telefonu z formularza
      address: thisBooking.dom.address.value,    //adres z formularza
    };

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    };

    fetch(url, options)
      .then(function (response){
        return response.json();
      })
      .then(function(parsedResponse){
        console.log('do api:', parsedResponse);
      });
    thisBooking.updateDOM();
  }
}

export default Booking;