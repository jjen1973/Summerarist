import { test } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { APP, PRICES, metadata, normalize, assertOwned, testKey, validOrigin, registeredUser, billingService } from '../billing.js';

const now = Math.floor(Date.now()/1000);
function subscription(plan='monthly', status='active') {
  return { id:'sub_fixture', livemode:false, customer:'cus_fixture', metadata:metadata('alice'), status, trial_end:now+604800, items:{data:[{quantity:1,price:{id:PRICES[plan]},current_period_end:now+2592000}]}, latest_invoice:{status:'paid'}, cancel_at_period_end:false };
}
function fixture() {
  const accounts={}, records={}, processed=new Set(), calls=[]; let subs=[];
  const repository={
    account:async uid=>accounts[uid], updateAccount:async(uid,value)=>{accounts[uid]={...accounts[uid],...value};},
    bindCustomer:async(uid,id)=>{accounts[uid]={...accounts[uid],customerId:id};},
    subscription:async(uid,id,value)=>{records[uid+':'+id]=value;},
    owner:async id=>Object.keys(accounts).find(uid=>accounts[uid].customerId===id),
    processed:async id=>processed.has(id),markProcessed:async id=>processed.add(id),withLock:async(_uid,cb)=>cb(),
  };
  const stripe={customers:{create:async()=>({id:'cus_fixture',livemode:false})},prices:{retrieve:async id=>({id,livemode:false,active:true,currency:'usd',unit_amount:id===PRICES.monthly?999:9999,recurring:{interval:id===PRICES.monthly?'month':'year',interval_count:1,usage_type:'licensed'}})},
    subscriptions:{list:async function*(){yield* subs;},retrieve:async()=>subs[0],cancel:async()=>{subs[0].status='canceled';}},
    checkout:{sessions:{create:async body=>{calls.push(body);return{id:'cs_test_fixture',livemode:false,url:'https://checkout.stripe.com/c/pay/cs_test_fixture'};},retrieve:async()=>({id:'cs_test_fixture',livemode:false,customer:'cus_fixture',metadata:metadata('alice'),status:'expired'}),expire:async()=>{}}},
  };
  return {service:billingService({stripe,repository}),accounts,records,calls,processed,setSubs:value=>{subs=value;}};
}
test('Only Stripe test keys and exact hosted origins are accepted',()=>{
 assert.throws(()=>testKey('sk_live_fixture'));assert.equal(testKey('sk_test_fixture'),'sk_test_fixture');
 assert.equal(validOrigin('https://fir-practice-e7875.web.app'),true);
 for(const origin of ['https://fir-practice-e7875.web.app.evil.com','http://fir-practice-e7875.web.app','https://example.com',undefined])assert.equal(validOrigin(origin),false);
});
test('Stripe signatures require the original raw body and a recent timestamp',()=>{
 const stripe=new Stripe('sk_test_fixture');const secret='whsec_fixture';
 const payload=JSON.stringify({id:'evt_signed_fixture',livemode:false});
 const signature=stripe.webhooks.generateTestHeaderString({payload,secret});
 assert.equal(stripe.webhooks.constructEvent(Buffer.from(payload),signature,secret).id,'evt_signed_fixture');
 assert.throws(()=>stripe.webhooks.constructEvent(payload+' ',signature,secret));
 const expired=stripe.webhooks.generateTestHeaderString({payload,secret,timestamp:now-600});
 assert.throws(()=>stripe.webhooks.constructEvent(payload,expired,secret));
});
test('Anonymous or missing identities cannot subscribe',()=>{
 assert.throws(()=>registeredUser({uid:'guest',firebase:{sign_in_provider:'anonymous'}}));assert.throws(()=>registeredUser(null));
 assert.equal(registeredUser({uid:'alice',firebase:{sign_in_provider:'password'}}),'alice');
});
test('Paid monthly and seven-day trial normalize to different premium roles',()=>{
 assert.equal(normalize(subscription()).premium,'premium');assert.equal(normalize(subscription('yearly','trialing')).premium,'premium-plus');
});
test('Unpaid, past-due, canceled, expired and unknown-price subscriptions grant no access',()=>{
 for(const status of ['past_due','canceled','incomplete','unpaid','paused'])assert.equal(normalize(subscription('monthly',status)).premium,null);
 assert.equal(normalize({...subscription(),latest_invoice:{status:'open'}}).premium,null);
 assert.equal(normalize({...subscription('yearly','trialing'),trial_end:now-1}).premium,null);
 const unknown=subscription();unknown.items.data[0].price.id='price_unapproved';assert.equal(normalize(unknown).premium,null);
 const expired=subscription();expired.items.data[0].current_period_end=now-1;assert.equal(normalize(expired).premium,null);
});
test('Live mode, another customer and another Firebase owner are rejected',()=>{
 for(const value of [{...subscription(),livemode:true},{...subscription(),customer:'cus_other'},{...subscription(),metadata:metadata('bob')}])assert.throws(()=>assertOwned(value,'alice','cus_fixture'));
});
test('Yearly Checkout sets seven-day trial and approved price server-side without exposing uid',async()=>{
 const f=fixture();await f.service.checkout('alice','yearly','https://fir-practice-e7875.web.app');
 const request=f.calls[0];assert.equal(request.subscription_data.trial_period_days,7);assert.equal(request.line_items[0].price,PRICES.yearly);assert.equal(request.metadata.app,APP);assert.ok(!JSON.stringify(request).includes('alice'));
});
test('Monthly Checkout has no trial; arbitrary price/plan/return origins are rejected',async()=>{
 const f=fixture();await f.service.checkout('alice','monthly','https://fir-practice-e7875.web.app');assert.equal(f.calls[0].subscription_data.trial_period_days,undefined);
 await assert.rejects(f.service.checkout('alice','price_attacker','https://fir-practice-e7875.web.app'));
 await assert.rejects(f.service.checkout('alice','yearly','https://evil.com'));
});
test('Duplicate active checkout is blocked; cancellation removes persisted entitlement',async()=>{
 const f=fixture();f.accounts.alice={customerId:'cus_fixture'};f.setSubs([subscription()]);
 await assert.rejects(f.service.checkout('alice','yearly','https://fir-practice-e7875.web.app'));
 assert.equal((await f.service.cancel('alice')).premium,null);assert.equal(f.records['alice:sub_fixture'].status,'canceled');
});
test('Webhooks use server-owned customer mapping, reconcile current state, and deduplicate',async()=>{
 const f=fixture();f.accounts.alice={customerId:'cus_fixture'};f.setSubs([subscription()]);
 const e={id:'evt_fixture',livemode:false,type:'customer.subscription.updated',data:{object:{customer:'cus_fixture',metadata:metadata('bob'),status:'canceled'}}};
 await f.service.event(e);assert.equal(f.records['alice:sub_fixture'].premium,'premium');assert.equal(f.records['bob:sub_fixture'],undefined);
 assert.deepEqual(await f.service.event(e),{duplicate:true});await assert.rejects(f.service.event({...e,livemode:true}));
});
test('Failed webhook reconciliation is not marked processed and can retry',async()=>{
 const f=fixture();f.accounts.alice={customerId:'cus_fixture'};f.setSubs([{...subscription(),metadata:metadata('bob')}]);
 const e={id:'evt_retry',livemode:false,type:'invoice.paid',data:{object:{customer:'cus_fixture'}}};
 await assert.rejects(f.service.event(e));assert.equal(f.processed.has(e.id),false);
 f.setSubs([subscription()]);await f.service.event(e);assert.equal(f.processed.has(e.id),true);
});
