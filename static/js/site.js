var format = (function() {
    var re = /\{([^}]+)\}/g;
    return function(s, args) {
        if (!s) {
            throw "Format string is empty!";
        }
        if (!args) return;
        if (!(args instanceof Array || args instanceof Object))
            args = Array.prototype.slice.call(arguments, 1);
        return s.replace(re, function(_, match){ return args[match]; });
    };
})();

var trim = (function() {
    var length = 100;
    return function(s) {
        if (s.length > length) {
            return s.substring(0, length) + '...';
        }
        return s;
    };
})();

function notify(url) {
  var _notify = function() {
    var notification = new Notification(
        'Triage with me',
        {body: url.get('title')}
    ).onclick(window.open(url.get('url')));
  };

  if (!("Notification" in window)) {
    return;
  }
  else if (Notification.permission === "granted") {
    _notify();
  }
  else if (Notification.permission !== 'denied') {
    Notification.requestPermission(function (permission) {
      if (permission === "granted") {
        _notify();
      }
    });
  }
}

(function($) {
    var res = [
      /^https:\/\/(bug)zilla\.mozilla\.org.*\?id=(\d+)$/,
      /^https:\/\/github\.com\/.*?\/(issue)s\/(\d+)$/,
      /^https:\/\/github\.com\/.*?\/(pull)\/(\d+)$/
    ];
    if ($('#triages').length > 0) {
        $.getJSON('/api/', function(data) {
            for (var record in data.entries) {
                var key = data.entries[record];
                $('#triages tbody').append(
                    format('<tr><td><a href="/triage.html#{0}">{1}</a></td>' +
                           '<td>{2}</td></tr>', key, key,
                           (new Date(parseInt(key))).toString())
                );
            }
        });
    } else {
        var key = window.location.hash.substr(1);
        var URL = Backbone.Model.extend({
            initialize: function() {
              var bug_ = null;
              for (var k = 0; k < res.length; k++) {
                if (bug_ === null) {
                  bug_ = res[k].exec(this.get('url'));
                }
              }
              this.set({
                bug: bug_ ? bug_[1] : null
              });
            }
        });
        var URLs = Backbone.Collection.extend({
            model: URL
        });
        var URLsView = Backbone.View.extend({
            el: $('#urls tbody'),
            initialize: function() {
                var self = this;
                _.bindAll(this, 'render', 'appendItem');
                this.collection = new URLs();
                this.collection.bind('add', this.appendItem);

                $('#triage-id').text(key);
                $.getJSON('/api/' + key + '/', function(data) {
                    for (var record in data.entries) {
                        var url = new URL({
                            url: data.entries[record].url,
                            title: data.entries[record].title
                        });
                        self.collection.add(url);
                    }
                });
                var source = new EventSource('/api-events/' + key + '/');
                source.addEventListener('message', function(e) {
                    var json = JSON.parse(e.data);
                    var url = new URL({
                        url: json.url,
                        title: json.title
                    });
                    self.collection.add(url);
                    notify(url);
                }, false);

                this.render();
            },
            render: function() {
                var self = this;
                _(this.collection.models).each(function(item){
                    self.appendItem(item);
                }, this);
            },
            appendItem: function(item){
                var url = item.get('url');
                var title = item.get('title');
                var bug = item.get('bug');
                $('span.label-warning').remove();
                $(this.el).prepend(format(
                    '<tr><td><span class="label label-warning">latest</span> &nbsp; ' +
                    '<span class="label label-{0}">{1}</span></td><td>' +
                    '<a target="_blank" href="{2}">{3}</td></tr>',
                    bug ? bug : 'other', bug ? bug : 'other', url, bug ? title : trim(url)
                ));
            }
        });
        var urlsView = new URLsView();

    }
})(jQuery);
