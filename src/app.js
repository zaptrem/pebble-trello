var UI = require('ui');
var Vector2 = require('vector2');

var main = new UI.Card({
  title: 'Trello',
  icon: 'trellogo-logo.png',
  subtitle: 'Missing settings',
  body: 'Please open the settings'
});

var loadedInit = false;

Pebble.addEventListener('showConfiguration', function() {
  Pebble.openURL('https://trello.com/1/authorize?callback_method=fragment&scope=read,write&expiration=never&name=Pebble&key=e3227833b55cbe24bfedd05e5ec870dd&return_url=https://pebble-trello.appspot.com');
});

Pebble.addEventListener("webviewclosed", function (e) {
  var decoded = decodeURIComponent(e.response);
  console.log("Decoded:"+decoded);
  var configuration;
  try {
    configuration = JSON.parse(decoded);
  } catch(err) {
    console.log("Failed to parse:"+err);
    // no configuration needed?
    if (localStorage.getItem("token") && !loadedInit) {
      console.log("token available, okay...");
      loadStuff();
    }
    return;
  }
  
  if(localStorage.getItem("token") == configuration.token) {
    console.log("Got already known token");
  }
  localStorage.setItem("token", configuration.token);
  console.log("Set token: "+configuration.token);
  loadStuff();
});

main.show();

if(localStorage.getItem("token")) {
  loadStuff();
}

function decodeUtf8(utftext) {
  var minimalMappingUtf8ToIso8859 = {
    228:'ae',
    196:'Ae',
    252:'ue',
    220:'Ue',
    246:'oe',
    214:'Oe',
    223:'ss'
  };
  var ret = "";
  for(var i=0; i<utftext.length; ++i) {
    if(utftext.charCodeAt(i) in minimalMappingUtf8ToIso8859) {
      ret += minimalMappingUtf8ToIso8859[utftext.charCodeAt(i)];
    } else {
      ret += utftext[i];
    }
    if (utftext.charCodeAt(i) > 127) {
      console.log("charcode:"+utftext.charCodeAt(i));
    }
  }
  return ret;
}

function makeRequest(urlpath, success, fail, verb) {
  var req = new XMLHttpRequest();
  if(!verb) {
    verb = "get";
  }
  req.open(verb, 'https://api.trello.com/1/'+urlpath+'&key=e3227833b55cbe24bfedd05e5ec870dd&token='+localStorage.getItem("token"));
  req.onload = function(e) {
    if (req.readyState != 4)
        return;
    if(req.status == 200) {
      var decoded;
      console.log("Pre decode:"+window.btoa(req.responseText));
      try {
        decoded = decodeUtf8(req.responseText);
      } catch(err) {
        console.log("decoding failed:"+err);
        return;
      }
      console.log("got decoded:"+decoded);
      success(JSON.parse(decoded));
    } else {
      console.log("Http request failed :("+ req.responseText);
      fail(req.responseText);
    }
  };
  req.send(null);
}

function selectedList(list) {
  console.log("Selected list:"+JSON.stringify(list));
  makeRequest('lists/'+list.id+'/cards?fields=id,name,checklists&checklists=all', loadedCards, loadingFailed);
  main.hide();
  main = new UI.Card({
    title: 'Trello',
    icon: 'images/trellogo-logo.png',
    subtitle: 'Loading list...',
  });
  main.show();
}

function selectedBoard(board) {
  console.log("selected board:"+JSON.stringify(board));
  var items = [];
  for(var i in board.lists) {
    var list = board.lists[i];
    items.push({title:list.name});
  }
  var menu = new UI.Menu({
    sections: [{
      title: 'Lists:',
      items: items
    }]
  });
  menu.on('select', function(e) {
    selectedList(board.lists[e.itemIndex]);
    console.log('Selected item #' + e.itemIndex + ' of section #' + e.sectionIndex);
    console.log('The item is titled "' + e.item.title + '"');
  });
  menu.show();
}

function loadedCards(cards) {
  main.hide(); // remove main loading window

  if (cards.length == 1) {
    console.log("only one card. Chosing "+JSON.stringify(cards[0]));
    selectedCard(cards[0]);
    return;
  }
  var items = [];
  for(var i in cards) {
    var card = cards[i];
    items.push({title:card.name});
  }
  var menu = new UI.Menu({
    sections: [{
      title: 'Cards:',
      items: items
    }]
  });
  menu.on('select', function(e) {
    selectedCard(cards[e.itemIndex]);
    console.log('Selected item #' + e.itemIndex + ' of section #' + e.sectionIndex);
    console.log('The item is titled "' + e.item.title + '"');
  });
  menu.show();
}

function selectedCard(card) {
  var items = [];
  if (card.checklists.length == 1) {
    console.log("only one checklist. Choosing "+card.checklists[0].name);
    selectedChecklist(card.checklists[0], card.id);
    return;
  }
  for(var i in card.checklists) {
    var checklist = card.checklists[i];
    items.push({title:checklist.name});
  }
  var menu = new UI.Menu({
    sections: [{
      title: 'Checklists:',
      items: items
    }]
  });
  menu.on('select', function(e) {
    selectedChecklist(card.checklists[e.itemIndex], card.id);
    console.log('Selected item #' + e.itemIndex + ' of section #' + e.sectionIndex);
    console.log('The item is titled "' + e.item.title + '"');
  });
  menu.show();
}

function stateToIcon(state) {
  return state == 'incomplete'? 'images/trello-box.png':'images/trello-checked.png';
}

function negateState(state) {
  return state == 'incomplete'? 'complete':'incomplete';
}

function selectedChecklist(checklist, cardid) {
  var items = [];
  checklist.checkItems.sort(function(a, b) {
    return a.pos - b.pos;
  });
  for(var i in checklist.checkItems) {
    var item = checklist.checkItems[i];
    var title = item.name;
    var subtitle = '';
    if(title.length > 13) {
      subtitle = title.substr(11);
      title = title.substr(0,11)+"-";
    }
    items.push({title:title, subtitle:subtitle,
                icon: stateToIcon(item.state)});
  }
  var menu = new UI.Menu({
    sections: [{
      title: 'Items:',
      items: items
    }]
  });
  menu.on('select', function(e) {
    var menuItem = menu.item(e.sectionIndex, e.itemIndex);
    var dataItem = checklist.checkItems[e.itemIndex];
    console.log('Selected item #' + e.itemIndex + ' of section #' + e.sectionIndex);
    console.log('The item is titled "' + e.item.title + '"');
    
    menuItem.icon = 'images/trello-pending.png';
    menu.item(e.sectionIndex, e.itemIndex, menuItem);
    selectedItem(dataItem, checklist.id, cardid, function() {
      console.log("Success callback! current state:"+dataItem.state);
      dataItem.state = negateState(dataItem.state);
      console.log("Newstate:"+dataItem.state);
      menuItem.icon = stateToIcon(dataItem.state);
      menu.item(e.sectionIndex, e.itemIndex, menuItem);
    }, function() {
      menuItem.icon = stateToIcon(dataItem.state);
      menu.item(e.sectionIndex, e.itemIndex, menuItem);
    });
  });
  menu.show();
}

function selectedItem(item, checklistid, cardid, success, fail) {
  console.log("Selected item:"+JSON.stringify(item));
  console.log("cardid:"+cardid);
  console.log("checklistid:"+checklistid);
  console.log("itemid:"+item.id);
  var newState = negateState(item.state);
  makeRequest("cards/"+cardid+"/checklist/"+checklistid+"/checkItem/"+item.id+"/state?value="+newState, success, fail, "PUT");
}

function loadedUser(user) {
  var items = [];
  for(var i in user.boards) {
    var board = user.boards[i];
    items.push({title:board.name});
  }
  var menu = new UI.Menu({
    sections: [{
      title: 'Boards:',
      items: items
    }]
  });
  menu.on('select', function(e) {
    selectedBoard(user.boards[e.itemIndex]);
    console.log('Selected item #' + e.itemIndex + ' of section #' + e.sectionIndex);
    console.log('The item is titled "' + e.item.title + '"');
  });
  main.hide();
  menu.show();
}

function loadingFailed(text) {
  console.log("error:"+text);
  main.hide();
  main = new UI.Card({
    title: 'Trello',
    icon: 'images/trellogo-logo.png',
    subtitle: 'Error :(',
  });
  main.show();
}

function loadStuff() {
  loadedInit = true;
  main.hide();
  main = new UI.Card({
    title: 'Trello',
    icon: 'images/trellogo-logo.png',
    subtitle: 'Loading boards...',
  });
  main.show();
  console.log("changed main");
  makeRequest('members/me?fields=username&boards=open&board_lists=open', loadedUser, loadingFailed);
}


main.on('click', 'up', function(e) {
  var menu = new UI.Menu({
    sections: [{
      items: [{
        title: 'Pebble.js',
        icon: 'images/menu_icon.png',
        subtitle: 'Can do Menus'
      }, {
        title: 'Second Item',
        subtitle: 'Subtitle Text'
      }]
    }]
  });
  menu.on('select', function(e) {
    console.log('Selected item #' + e.itemIndex + ' of section #' + e.sectionIndex);
    console.log('The item is titled "' + e.item.title + '"');
  });
  menu.show();
});


main.on('click', 'select', function(e) {
  var wind = new UI.Window();
  var textfield = new UI.Text({
    position: new Vector2(0, 50),
    size: new Vector2(144, 30),
    font: 'gothic-24-bold',
    text: 'Text Anywhere!',
    textAlign: 'center'
  });
  wind.add(textfield);
  wind.show();
});

main.on('click', 'down', function(e) {
  var card = new UI.Card();
  card.title('A Card');
  card.subtitle('Is a Window');
  card.body('The simplest window type in Pebble.js.');
  card.show();
});
