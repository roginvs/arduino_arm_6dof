#include <Servo.h>

#define SERVO_COUNT 6

Servo myservo[SERVO_COUNT]; // create servo object to control a servo
// twelve servo objects can be created on most boards

int pos = 0; // variable to store the servo position

void setup()
{
    for (int i = 0; i < SERVO_COUNT; i++)
    {
        myservo[i].attach(8 + i);
    };

    for (int i = 0; i < SERVO_COUNT; i++)
    {
        myservo[i].write(80);
    };

    delay(1000);
    for (int i = 0; i < SERVO_COUNT; i++)
    {
        myservo[i].write(90);
    };
}

void loop()
{
}
