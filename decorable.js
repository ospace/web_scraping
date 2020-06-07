
/*
  데코레이트 패턴 적용: 특정 메소드 호출시 결과에 대한 장식 효과
  예제)
  function Foo() {  }
  Foo.prototype.name = function() { return 'foo' };

  extend(FooBar, Foo);
  mixin(FooBar, Decorable);
  function FooBar() {
    this.decorate('name', (item, str)=>{
        return `${str[0]}${str[1]}${item}${str[1]}${str[0]}`;
    });
  }

  f = new Foo();
  fb = new FooBar();
  console.log('f>', f.name());
  console.log('fb>', fb.name('#','*'));
 */
const Decorable = {
    decorate: function(methodName, decorator) {
        const method = this[methodName];
        if(!method || !decorator) return;
        this[methodName] = function(...args) {
            return decorator.apply(this, [method.apply(this, args)].concat(args));
        };
    }
}
exports.Decorable = Decorable;