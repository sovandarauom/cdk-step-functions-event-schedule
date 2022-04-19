import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Function, Code, Runtime } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { StateMachine, Wait, WaitTime } from 'aws-cdk-lib/aws-stepfunctions';
import { Duration } from 'aws-cdk-lib';
import { Schedule, Rule } from 'aws-cdk-lib/aws-events';
import * as path from 'path';
import { SfnStateMachine } from 'aws-cdk-lib/aws-events-targets';

export class CdkStepFunctionsEventScheduleStack extends Stack {
  public machine: StateMachine;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const querySmsTable = new Function(this, 'querySmsTable', {
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset(path.join(__dirname, 'handlers')),
      handler: 'query-sms-table.handler',
      memorySize: 128,
      logRetention: RetentionDays.ONE_DAY,
    });

    const queryCustomer = new Function(this, 'queryCustomer', {
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset(path.join(__dirname, 'handlers')),
      handler: 'query-customer-table.handler',
      memorySize: 128,
      logRetention: RetentionDays.ONE_DAY,
    });

    const sendNotification = new Function(this, 'sendNotification', {
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset(path.join(__dirname, 'handlers')),
      handler: 'send-notification.handler',
      memorySize: 128,
      logRetention: RetentionDays.ONE_DAY,
    });

    const updateSmsTable = new Function(this, 'updateSmsTable', {
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset(path.join(__dirname, 'handlers')),
      handler: 'update-sms-table.handler',
      memorySize: 128,
      logRetention: RetentionDays.ONE_DAY,
    });

    const definition = new LambdaInvoke(this, "Qeury Sms Table", {
      lambdaFunction: querySmsTable,
      outputPath: "$.Payload",
    })
      .next(
        new Wait(this, "Wait 1 Second", {
          time: WaitTime.duration(Duration.seconds(1)),
        })
      )
      .next(
        new LambdaInvoke(this, "Query Customer Table", {
          lambdaFunction: queryCustomer,
          outputPath: "$.Payload",
        })
      ).next(
        new LambdaInvoke(this, "Send Notification", {
          lambdaFunction: sendNotification,
          outputPath: "$.Payload",
        })
      ).next(
        new LambdaInvoke(this, "Update Sms Table", {
          lambdaFunction: updateSmsTable,
          outputPath: "$.Payload",
        })
      );

    this.machine = new StateMachine(this, "CdkStepFunctionsEventScheduleStack-StateMachine", {
      definition,
      timeout: Duration.minutes(5),
    
    });

    const machineTarget = new SfnStateMachine(this.machine);
    const eventRule = new Rule(this, 'scheduleRule', {
      schedule: Schedule.expression('cron(0/5 * * * ? *)'),
      targets: [machineTarget],
    });
  }
}
